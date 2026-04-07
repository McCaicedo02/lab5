const authorInfo = document.getElementById("authorInfo");
const authorLinks = document.querySelectorAll(".author-link");

const fallbackPortrait = "/img/default-portrait.svg";

const getValue = (author, keys, emptyValue = "Not available") => {
  for (const key of keys) {
    if (author[key] !== undefined && author[key] !== null && author[key] !== "") {
      return author[key];
    }
  }
  return emptyValue;
};

const buildAuthorMarkup = (author) => {
  const firstName = getValue(author, ["firstName", "firstname"], "");
  const lastName = getValue(author, ["lastName", "lastname"], "");
  const fullName =
    `${firstName} ${lastName}`.trim() ||
    getValue(author, ["fullName", "name"], "Unknown Author");

  const portrait = getValue(author, ["portrait", "image", "photo"], fallbackPortrait);
  const dob = getValue(author, ["dob", "birthDate"]);
  const dod = getValue(author, ["dod", "deathDate"]);
  const sex = getValue(author, ["sex", "gender"]);
  const profession = getValue(author, ["profession", "occupation"]);
  const country = getValue(author, ["country", "nationality"]);
  const biography = getValue(author, ["biography", "bio", "description"]);

  return `
    <div class="author-profile">
      <img
        src="${portrait}"
        alt="${fullName}"
        class="author-portrait"
        onerror="this.onerror=null;this.src='${fallbackPortrait}';"
      >
      <div class="author-meta">
        <h3 class="h2 mb-2">${fullName}</h3>
        <p><strong>Date of Birth:</strong> ${dob}</p>
        <p><strong>Date of Death:</strong> ${dod}</p>
        <p><strong>Sex:</strong> ${sex}</p>
        <p><strong>Profession:</strong> ${profession}</p>
        <p><strong>Country:</strong> ${country}</p>
        <p class="author-bio"><strong>Biography:</strong> ${biography}</p>
      </div>
    </div>
  `;
};

authorLinks.forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();

    if (!authorInfo) {
      return;
    }

    authorInfo.innerHTML = `<div class="text-center py-4">Loading author information...</div>`;

    try {
      const response = await fetch(`/api/author/${link.id}`);

      if (!response.ok) {
        throw new Error("Unable to load author information.");
      }

      const author = await response.json();
      authorInfo.innerHTML = buildAuthorMarkup(author);
    } catch (error) {
      authorInfo.innerHTML = `
        <div class="alert alert-danger mb-0" role="alert">
          ${error.message}
        </div>
      `;
    }
  });
});
