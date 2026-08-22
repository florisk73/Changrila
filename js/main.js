// Navbar mobile toggle
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector("#site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

// ------- Gallery modal with next/prev -------
const gallery = document.querySelector("[data-gallery]");
const modal = document.querySelector("[data-modal]");
const modalImg = modal?.querySelector(".modal-image");
const closeButtons = document.querySelectorAll("[data-close-modal]");
const prevBtn = modal?.querySelector("[data-prev]");
const nextBtn = modal?.querySelector("[data-next]");

let galleryImages = [];
let currentIndex = -1;

function loadGalleryImages() {
  if (!gallery) return [];
  const imgs = Array.from(gallery.querySelectorAll("img"));
  return imgs.map(img => ({
    src: img.src,
    alt: img.alt || "Resort photo"
  }));
}

function showAt(index) {
  if (!modal || !modalImg) return;
  if (galleryImages.length === 0) return;

  // wrap around
  currentIndex = (index + galleryImages.length) % galleryImages.length;

  modalImg.src = galleryImages[currentIndex].src;
  modalImg.alt = galleryImages[currentIndex].alt;
}

function openModal(startIndex) {
  if (!modal || !modalImg) return;
  galleryImages = loadGalleryImages();
  if (galleryImages.length === 0) return;

  modal.hidden = false;
  document.body.style.overflow = "hidden";
  showAt(startIndex);
}

function closeModal() {
  if (!modal || !modalImg) return;
  modal.hidden = true;
  modalImg.src = "";
  modalImg.alt = "";
  document.body.style.overflow = "";
  currentIndex = -1;
}

function next() {
  if (currentIndex < 0) return;
  showAt(currentIndex + 1);
}

function prev() {
  if (currentIndex < 0) return;
  showAt(currentIndex - 1);
}

if (gallery) {
  gallery.addEventListener("click", (e) => {
    const btn = e.target.closest("button.thumb");
    if (!btn) return;

    const imgs = Array.from(gallery.querySelectorAll("img"));
    const clickedImg = btn.querySelector("img");
    const index = imgs.indexOf(clickedImg);

    openModal(index);
  });
}

closeButtons.forEach((btn) => btn.addEventListener("click", closeModal));
prevBtn?.addEventListener("click", prev);
nextBtn?.addEventListener("click", next);

document.addEventListener("keydown", (e) => {
  if (!modal || modal.hidden) return;

  if (e.key === "Escape") closeModal();
  if (e.key === "ArrowRight") next();
  if (e.key === "ArrowLeft") prev();
});

// ------- Page swipe navigation -------
// Order of pages to swipe through
const PAGE_ORDER = ["index.html", "rooms.html", ".html", "contact.html"];

function currentPage() {
  const path = window.location.pathname;
  const file = path.split("/").pop() || "index.html";
  return file === "" ? "index.html" : file;
}

function getAdjacentPages() {
  const current = currentPage();
  const idx = PAGE_ORDER.indexOf(current);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? PAGE_ORDER[idx - 1] : null,
    next: idx < PAGE_ORDER.length - 1 ? PAGE_ORDER[idx + 1] : null
  };
}

function navigateTo(page) {
  if (!page) return;
  window.location.href = page;
}

// Show arrow hints on page load, fade out after 3 seconds
function showSwipeHints() {
  const { prev, next } = getAdjacentPages();
  if (!prev && !next) return;

  const hint = document.createElement("div");
  hint.className = "swipe-hints";
  hint.innerHTML = `
    ${prev ? '<div class="swipe-hint swipe-hint-left">&#8592;</div>' : '<div class="swipe-hint swipe-hint-hidden"></div>'}
    ${next ? '<div class="swipe-hint swipe-hint-right">&#8594;</div>' : '<div class="swipe-hint swipe-hint-hidden"></div>'}
  `;
  document.body.appendChild(hint);

  setTimeout(() => hint.classList.add("swipe-hints-fade"), 3000);
  setTimeout(() => hint.remove(), 3800);
}

// Touch swipe detection
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", (e) => {
  if (modal && !modal.hidden) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
  const { prev, next } = getAdjacentPages();
  if (dx < 0) navigateTo(next);
  if (dx > 0) navigateTo(prev);
}, { passive: true });

// Keyboard arrow keys (desktop) - only when modal is closed
document.addEventListener("keydown", (e) => {
  if (modal && !modal.hidden) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
  if (e.key === "ArrowRight" && !e.altKey) {
    const { next } = getAdjacentPages();
    navigateTo(next);
  }
  if (e.key === "ArrowLeft" && !e.altKey) {
    const { prev } = getAdjacentPages();
    navigateTo(prev);
  }
});

showSwipeHints();

// ------- Shared footer loader -------
// Loads includes/footer.html into <div id="site-footer"> on every page.
// Requires a local server (VSCode Live Server) — won't work on file:// paths.
const footerSlot = document.getElementById("site-footer");
if (footerSlot) {
  fetch("includes/footer.html")
    .then(r => {
      if (!r.ok) throw new Error("Footer not found");
      return r.text();
    })
    .then(html => {
      footerSlot.innerHTML = html;
      // Set copyright year after footer is injected
      const yearEl = document.getElementById("year");
      if (yearEl) yearEl.textContent = new Date().getFullYear();
    })
    .catch(err => console.warn("Footer load failed:", err));
} else {
  // Fallback: set year if footer is still hardcoded on this page
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}