(function () {
  "use strict";

  var APP_NAME = "cottagecore-mens-lookbook";
  var PHOTOS_PER_CATEGORY = 4;
  var ACCESS_KEY = window.UNSPLASH_ACCESS_KEY || "";

  var CATEGORIES = [
    {
      title: "Linen Shirts",
      query: "linen shirt men",
      caption: "Loose-woven, slightly rumpled — the workhorse of a warm-weather wardrobe."
    },
    {
      title: "Chambray & Indigo",
      query: "chambray shirt indigo denim",
      caption: "Soft blues that fade honestly with wear, somewhere between work-shirt and heirloom."
    },
    {
      title: "Wool Knits",
      query: "wool sweater knit men",
      caption: "Hand-feel over hype — cabled, cable-less, and everything in between."
    },
    {
      title: "Waxed & Chore Coats",
      query: "waxed jacket chore jacket",
      caption: "Built for orchards and errands alike; better the more weather it's seen."
    },
    {
      title: "Relaxed Trousers",
      query: "linen trousers men",
      caption: "Drape, not drag — trousers cut for movement and a long lunch."
    },
    {
      title: "Leather Boots",
      query: "leather boots brown",
      caption: "Brown leather, broken in, built to be re-soled rather than replaced."
    },
    {
      title: "Full Outfits & Vibe",
      query: "cottagecore men outfit neutral menswear",
      caption: "How it all sits together — soft tailoring, natural color, unhurried mood."
    }
  ];

  var main = document.getElementById("lookbook");

  function utm(url) {
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    return url + sep + "utm_source=" + APP_NAME + "&utm_medium=referral";
  }

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function buildHeading(category, index) {
    var heading = el("div", "category-heading");
    heading.appendChild(el("h2", null, category.title));
    heading.appendChild(
      el("span", "category-index", "0" + (index + 1) + " / 0" + CATEGORIES.length)
    );
    return heading;
  }

  function placeholderCard() {
    var card = el("div", "photo-card");
    var frame = el("div", "photo-frame");
    frame.appendChild(el("div", "placeholder", "loading"));
    card.appendChild(frame);
    return { card: card, frame: frame };
  }

  function showImageError(frame, onRetry) {
    frame.innerHTML = "";
    var errorState = el("div", "error-state", "couldn't load");
    var button = el("button", null, "Retry");
    button.addEventListener("click", onRetry);
    errorState.appendChild(button);
    frame.appendChild(errorState);
  }

  function mountImage(frame, src, credit) {
    frame.innerHTML = "";
    var img = document.createElement("img");
    img.loading = "lazy";
    img.alt = credit ? credit.alt : "Photograph";

    function attempt() {
      img.classList.remove("loaded");
      img.src = src;
    }

    img.addEventListener("load", function () {
      img.classList.add("loaded");
    });
    img.addEventListener("error", function () {
      showImageError(frame, attempt);
    });

    frame.appendChild(img);
    attempt();
  }

  function creditNode(credit) {
    var p = el("p", "photo-credit");
    if (!credit) {
      p.textContent = "Photo via Unsplash Source";
      return p;
    }
    var a1 = document.createElement("a");
    a1.href = credit.photographerLink;
    a1.target = "_blank";
    a1.rel = "noopener";
    a1.textContent = credit.photographerName;

    var a2 = document.createElement("a");
    a2.href = credit.photoLink;
    a2.target = "_blank";
    a2.rel = "noopener";
    a2.textContent = "Unsplash";

    p.appendChild(document.createTextNode("Photo by "));
    p.appendChild(a1);
    p.appendChild(document.createTextNode(" on "));
    p.appendChild(a2);
    return p;
  }

  function fillCard(parts, src, credit) {
    mountImage(parts.frame, src, {
      alt: credit ? credit.alt : "Photograph related to the category"
    });
    parts.card.appendChild(creditNode(credit));
  }

  function sourceFallbackUrl(query, seed) {
    var q = encodeURIComponent(query);
    return "https://source.unsplash.com/featured/600x750/?" + q + "&sig=" + seed;
  }

  function renderFallback(grid, query) {
    var cards = [];
    for (var i = 0; i < PHOTOS_PER_CATEGORY; i++) {
      var parts = placeholderCard();
      grid.appendChild(parts.card);
      cards.push(parts);
    }
    cards.forEach(function (parts, i) {
      fillCard(parts, sourceFallbackUrl(query, i + 1 + Math.floor(Math.random() * 1000)), null);
    });
  }

  function fetchUnsplash(query) {
    var url =
      "https://api.unsplash.com/search/photos?per_page=" +
      PHOTOS_PER_CATEGORY +
      "&orientation=portrait&query=" +
      encodeURIComponent(query);

    return fetch(url, {
      headers: { Authorization: "Client-ID " + ACCESS_KEY }
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Unsplash API responded with " + response.status);
      }
      return response.json();
    });
  }

  function renderApiResults(grid, results, query) {
    if (!results.length) {
      renderFallback(grid, query);
      return;
    }
    results.slice(0, PHOTOS_PER_CATEGORY).forEach(function (photo) {
      var parts = placeholderCard();
      grid.appendChild(parts.card);
      var credit = {
        photographerName: photo.user.name,
        photographerLink: utm(photo.user.links.html),
        photoLink: utm(photo.links.html),
        alt: photo.alt_description || query
      };
      fillCard(parts, photo.urls.regular, credit);
    });
  }

  function renderCategoryError(grid, onRetry) {
    grid.innerHTML = "";
    var errorState = el("div", "error-state", "couldn't load this section");
    var button = el("button", null, "Retry");
    button.addEventListener("click", onRetry);
    errorState.appendChild(button);
    grid.appendChild(errorState);
  }

  function loadCategory(grid, category) {
    grid.innerHTML = "";
    var skeletons = [];
    for (var i = 0; i < PHOTOS_PER_CATEGORY; i++) {
      var parts = placeholderCard();
      grid.appendChild(parts.card);
      skeletons.push(parts);
    }

    if (!ACCESS_KEY) {
      grid.innerHTML = "";
      renderFallback(grid, category.query);
      return;
    }

    fetchUnsplash(category.query)
      .then(function (data) {
        grid.innerHTML = "";
        renderApiResults(grid, data.results || [], category.query);
      })
      .catch(function () {
        renderCategoryError(grid, function () {
          loadCategory(grid, category);
        });
      });
  }

  function buildCategorySection(category, index) {
    var section = el("section", "category");
    section.appendChild(buildHeading(category, index));
    section.appendChild(el("p", "category-caption", category.caption));

    var grid = el("div", "photo-grid");
    section.appendChild(grid);

    main.appendChild(section);
    loadCategory(grid, category);
  }

  function maybeShowConfigBanner() {
    if (ACCESS_KEY) return;
    var banner = el(
      "div",
      "config-banner",
      "No Unsplash API key set — showing unattributed fallback images from Unsplash Source. " +
        "Copy <code>config.example.js</code> to <code>config.js</code> and paste a free key " +
        "from unsplash.com/developers to see full photographer credits."
    );
    main.parentNode.insertBefore(banner, main);
  }

  function init() {
    maybeShowConfigBanner();
    CATEGORIES.forEach(function (category, index) {
      buildCategorySection(category, index);
    });
  }

  init();
})();
