import express from "express";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: "sql3.freesqldatabase.com",
  user: "sql3822459",
  password: "WjyCfea91R",
  database: "sql3822459",
  connectionLimit: 10,
  waitForConnections: true
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

app.get("/", async (req, res) => {
  try {
    const [authors] = await pool.query(`
      SELECT authorId, firstName, lastName
      FROM q_authors
      ORDER BY lastName, firstName
    `);

    const [categories] = await pool.query(`
      SELECT DISTINCT category
      FROM q_quotes
      WHERE category IS NOT NULL AND category <> ''
      ORDER BY category
    `);

    res.render("index", { authors, categories });
  } catch (error) {
    console.error("Error loading home page:", error);
    res.status(500).send("Error loading Quote Finder.");
  }
});

app.get("/dbTest", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT CURDATE()");
    res.send(rows);
  } catch (error) {
    console.error("Database test failed:", error);
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
