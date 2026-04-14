import express from "express";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

const requiredEnvVars = [
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "DB_PORT"
];

const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);

if (missingEnvVars.length) {
  throw new Error(
    `Missing required database environment variables: ${missingEnvVars.join(", ")}`
  );
}

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 10000
};

if (Number.isNaN(dbConfig.port)) {
  throw new Error(`Invalid DB_PORT value: ${process.env.DB_PORT}`);
}

const pool = mysql.createPool(dbConfig);

function logDatabaseError(context, error) {
  console.error(`[DB] ${context}`);
  console.error(`[DB] Host: ${dbConfig.host}`);
  console.error(`[DB] Port: ${dbConfig.port}`);
  console.error(`[DB] Database: ${dbConfig.database}`);
  console.error(`[DB] Code: ${error.code || "N/A"}`);
  console.error(`[DB] Errno: ${error.errno || "N/A"}`);
  console.error(`[DB] Syscall: ${error.syscall || "N/A"}`);
  console.error(`[DB] Message: ${error.message}`);
}

async function verifyDatabaseConnection() {
  console.log(
    `[DB] Attempting connection to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
  );

  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log(
      `[DB] Connected to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
    );
  } catch (error) {
    logDatabaseError("Initial database connection failed.", error);
  }
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

function formatDateForInput(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeText(value) {
  return value?.trim() || "";
}

function normalizeNullableText(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeLikes(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function getAuthors() {
  const [authors] = await pool.query(
    `
      SELECT authorId, firstName, lastName
      FROM q_authors
      ORDER BY lastName, firstName
    `
  );

  return authors;
}

async function getCategories() {
  const [categories] = await pool.query(
    `
      SELECT DISTINCT category
      FROM q_quotes
      WHERE category IS NOT NULL AND category <> ''
      ORDER BY category
    `
  );

  return categories;
}

app.get("/admin", (req, res) => {
  res.render("admin/index");
});

app.get("/", async (req, res) => {
  try {
    const [authors, categories] = await Promise.all([getAuthors(), getCategories()]);

    res.render("index", { authors, categories });
  } catch (error) {
    logDatabaseError("Error loading home page.", error);
    res.status(500).send("Error loading Quote Finder.");
  }
});

app.get("/dbTest", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT CURDATE()");
    res.send(rows);
  } catch (error) {
    logDatabaseError("Database test failed.", error);
    res.status(500).send("Database connection failed.");
  }
});

app.get("/searchByKeyword", async (req, res) => {
  const keyword = req.query.keyword?.trim() || "";

  try {
    const [quotes] = await pool.query(
      `
        SELECT
          q.quoteId,
          q.quote,
          q.category,
          q.likes,
          a.authorId,
          CONCAT(a.firstName, ' ', a.lastName) AS authorName
        FROM q_quotes q
        JOIN q_authors a ON q.authorId = a.authorId
        WHERE q.quote LIKE ?
        ORDER BY q.quote
      `,
      [`%${keyword}%`]
    );

    res.render("results", {
      heading: `Results for Keyword: ${keyword || "All Quotes"}`,
      quotes
    });
  } catch (error) {
    console.error("Keyword search failed:", error);
    res.status(500).send("Error searching by keyword.");
  }
});

app.get("/searchByAuthor", async (req, res) => {
  const authorId = req.query.authorId;

  try {
    const [quotes] = await pool.query(
      `
        SELECT
          q.quoteId,
          q.quote,
          q.category,
          q.likes,
          a.authorId,
          CONCAT(a.firstName, ' ', a.lastName) AS authorName
        FROM q_quotes q
        JOIN q_authors a ON q.authorId = a.authorId
        WHERE a.authorId = ?
        ORDER BY q.quote
      `,
      [authorId]
    );

    const heading = quotes.length
      ? `Results for Author: ${quotes[0].authorName}`
      : "Results for Author";

    res.render("results", { heading, quotes });
  } catch (error) {
    console.error("Author search failed:", error);
    res.status(500).send("Error searching by author.");
  }
});

app.get("/searchByCategory", async (req, res) => {
  const category = req.query.category || "";

  try {
    const [quotes] = await pool.query(
      `
        SELECT
          q.quoteId,
          q.quote,
          q.category,
          q.likes,
          a.authorId,
          CONCAT(a.firstName, ' ', a.lastName) AS authorName
        FROM q_quotes q
        JOIN q_authors a ON q.authorId = a.authorId
        WHERE q.category = ?
        ORDER BY q.quote
      `,
      [category]
    );

    res.render("results", {
      heading: `Results for Category: ${category}`,
      quotes
    });
  } catch (error) {
    console.error("Category search failed:", error);
    res.status(500).send("Error searching by category.");
  }
});

app.get("/searchByLikes", async (req, res) => {
  const minLikes = Number(req.query.minLikes ?? 0);
  const maxLikes = Number(req.query.maxLikes ?? 0);

  try {
    const [quotes] = await pool.query(
      `
        SELECT
          q.quoteId,
          q.quote,
          q.category,
          q.likes,
          a.authorId,
          CONCAT(a.firstName, ' ', a.lastName) AS authorName
        FROM q_quotes q
        JOIN q_authors a ON q.authorId = a.authorId
        WHERE q.likes BETWEEN ? AND ?
        ORDER BY q.likes DESC, q.quote
      `,
      [minLikes, maxLikes]
    );

    res.render("results", {
      heading: `Results for Likes Between ${minLikes} and ${maxLikes}`,
      quotes
    });
  } catch (error) {
    console.error("Likes search failed:", error);
    res.status(500).send("Error searching by likes.");
  }
});

app.get("/api/author/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT *
        FROM q_authors
        WHERE authorId = ?
      `,
      [req.params.id]
    );

    if (!rows.length) {
      res.status(404).json({ error: "Author not found." });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Author API failed:", error);
    res.status(500).json({ error: "Error loading author information." });
  }
});

app.get("/author/new", (req, res) => {
  res.render("admin/author/new");
});

app.post("/author/new", async (req, res) => {
  const {
    firstName,
    lastName,
    dob,
    dod,
    sex,
    profession,
    country,
    portrait,
    biography
  } = req.body;

  try {
    await pool.query(
      `
        INSERT INTO q_authors (
          firstName,
          lastName,
          dob,
          dod,
          sex,
          profession,
          country,
          portrait,
          biography
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        normalizeText(firstName),
        normalizeText(lastName),
        normalizeNullableText(dob),
        normalizeNullableText(dod),
        normalizeText(sex),
        normalizeText(profession),
        normalizeText(country),
        normalizeText(portrait),
        normalizeText(biography)
      ]
    );

    res.redirect("/authors");
  } catch (error) {
    console.error("Error adding author:", error);
    res.status(500).send("Error adding author.");
  }
});

app.get("/authors", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT *
        FROM q_authors
        ORDER BY lastName, firstName
      `
    );

    const authors = rows.map((author) => ({
      ...author,
      dobDisplay: formatDateForInput(author.dob),
      dodDisplay: formatDateForInput(author.dod)
    }));

    res.render("admin/author/list", { authors });
  } catch (error) {
    console.error("Error loading authors:", error);
    res.status(500).send("Error loading authors.");
  }
});

app.get("/author/edit", async (req, res) => {
  const { authorId } = req.query;

  try {
    const [authors] = await pool.query(
      `
        SELECT *
        FROM q_authors
        WHERE authorId = ?
      `,
      [authorId]
    );

    if (!authors.length) {
      res.status(404).send("Author not found.");
      return;
    }

    const author = {
      ...authors[0],
      dob: formatDateForInput(authors[0].dob),
      dod: formatDateForInput(authors[0].dod)
    };

    res.render("admin/author/edit", { author });
  } catch (error) {
    console.error("Error loading author:", error);
    res.status(500).send("Error loading author.");
  }
});

app.post("/author/edit", async (req, res) => {
  const {
    authorId,
    firstName,
    lastName,
    dob,
    dod,
    sex,
    profession,
    country,
    portrait,
    biography
  } = req.body;

  try {
    await pool.query(
      `
        UPDATE q_authors
        SET
          firstName = ?,
          lastName = ?,
          dob = ?,
          dod = ?,
          sex = ?,
          profession = ?,
          country = ?,
          portrait = ?,
          biography = ?
        WHERE authorId = ?
      `,
      [
        normalizeText(firstName),
        normalizeText(lastName),
        normalizeNullableText(dob),
        normalizeNullableText(dod),
        normalizeText(sex),
        normalizeText(profession),
        normalizeText(country),
        normalizeText(portrait),
        normalizeText(biography),
        authorId
      ]
    );

    res.redirect("/authors");
  } catch (error) {
    console.error("Error updating author:", error);
    res.status(500).send("Error updating author.");
  }
});

app.get("/author/delete", async (req, res) => {
  const { authorId } = req.query;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM q_quotes WHERE authorId = ?", [authorId]);
    await connection.query("DELETE FROM q_authors WHERE authorId = ?", [authorId]);
    await connection.commit();

    res.redirect("/authors");
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting author:", error);
    res.status(500).send("Error deleting author.");
  } finally {
    connection.release();
  }
});

app.get("/quote/new", async (req, res) => {
  try {
    const [authors, categories] = await Promise.all([getAuthors(), getCategories()]);
    res.render("admin/quote/new", { authors, categories });
  } catch (error) {
    console.error("Error loading new quote form:", error);
    res.status(500).send("Error loading form.");
  }
});

app.post("/quote/new", async (req, res) => {
  const { quote, authorId, category, likes } = req.body;

  try {
    await pool.query(
      `
        INSERT INTO q_quotes (quote, authorId, category, likes)
        VALUES (?, ?, ?, ?)
      `,
      [
        normalizeText(quote),
        authorId,
        normalizeNullableText(category),
        normalizeLikes(likes)
      ]
    );

    res.redirect("/quotes");
  } catch (error) {
    console.error("Error adding quote:", error);
    res.status(500).send("Error adding quote.");
  }
});

app.get("/quotes", async (req, res) => {
  try {
    const [quotes] = await pool.query(
      `
        SELECT
          q.quoteId,
          q.quote,
          q.category,
          q.likes,
          q.authorId,
          CONCAT(a.firstName, ' ', a.lastName) AS authorName
        FROM q_quotes q
        JOIN q_authors a ON q.authorId = a.authorId
        ORDER BY q.quote
      `
    );

    res.render("admin/quote/list", { quotes });
  } catch (error) {
    console.error("Error loading quotes:", error);
    res.status(500).send("Error loading quotes.");
  }
});

app.get("/quote/edit", async (req, res) => {
  const { quoteId } = req.query;

  try {
    const [quoteRows, authors, categories] = await Promise.all([
      pool
        .query(
          `
            SELECT quoteId, quote, authorId, category, likes
            FROM q_quotes
            WHERE quoteId = ?
          `,
          [quoteId]
        )
        .then(([rows]) => rows),
      getAuthors(),
      getCategories()
    ]);

    if (!quoteRows.length) {
      res.status(404).send("Quote not found.");
      return;
    }

    res.render("admin/quote/edit", {
      quote: quoteRows[0],
      authors,
      categories
    });
  } catch (error) {
    console.error("Error loading quote:", error);
    res.status(500).send("Error loading quote.");
  }
});

app.post("/quote/edit", async (req, res) => {
  const { quoteId, quote, authorId, category, likes } = req.body;

  try {
    await pool.query(
      `
        UPDATE q_quotes
        SET
          quote = ?,
          authorId = ?,
          category = ?,
          likes = ?
        WHERE quoteId = ?
      `,
      [
        normalizeText(quote),
        authorId,
        normalizeNullableText(category),
        normalizeLikes(likes),
        quoteId
      ]
    );

    res.redirect("/quotes");
  } catch (error) {
    console.error("Error updating quote:", error);
    res.status(500).send("Error updating quote.");
  }
});

app.get("/quote/delete", async (req, res) => {
  const { quoteId } = req.query;

  try {
    await pool.query("DELETE FROM q_quotes WHERE quoteId = ?", [quoteId]);
    res.redirect("/quotes");
  } catch (error) {
    console.error("Error deleting quote:", error);
    res.status(500).send("Error deleting quote.");
  }
});

await verifyDatabaseConnection();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
