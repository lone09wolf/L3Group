// Keep the gallery readable without JavaScript; enhance its existing links.
const galleryLinks = [...document.querySelectorAll("[data-photo-gallery] .photo-gallery__link")];

if (galleryLinks.length) {
  const viewer = document.createElement("dialog");
  viewer.className = "photo-viewer";
  viewer.setAttribute("aria-label", "Project photo viewer");
  viewer.innerHTML = `<div class="photo-viewer__bar"><p data-viewer-counter aria-live="polite"></p><button type="button" class="photo-viewer__close" aria-label="Close photo viewer" title="Close photo viewer">&#215;</button></div><div class="photo-viewer__stage"><button type="button" data-viewer-prev aria-label="Previous photo" title="Previous photo"><img src="/assets/chevron-left.svg" alt="" /></button><img class="photo-viewer__image" alt="" /><button type="button" data-viewer-next aria-label="Next photo" title="Next photo"><img src="/assets/chevron-right.svg" alt="" /></button></div><p class="photo-viewer__caption"></p>`;
  document.body.append(viewer);
  let activePhoto = 0;
  let returnFocus;
  const showPhoto = (index) => {
    activePhoto = (index + galleryLinks.length) % galleryLinks.length;
    const link = galleryLinks[activePhoto];
    const caption = link.querySelector("img").alt;
    const image = viewer.querySelector(".photo-viewer__image");
    image.src = link.href;
    image.alt = caption;
    viewer.querySelector("[data-viewer-counter]").textContent = `${activePhoto + 1} / ${galleryLinks.length}`;
    viewer.querySelector(".photo-viewer__caption").textContent = caption;
  };
  galleryLinks.forEach((link, index) => {
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      returnFocus = link;
      showPhoto(index);
      viewer.showModal();
      document.body.classList.add("photo-viewer-open");
    });
  });
  viewer.querySelector(".photo-viewer__close").addEventListener("click", () => viewer.close());
  viewer.querySelector("[data-viewer-prev]").addEventListener("click", () => showPhoto(activePhoto - 1));
  viewer.querySelector("[data-viewer-next]").addEventListener("click", () => showPhoto(activePhoto + 1));
  viewer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showPhoto(activePhoto + (event.key === "ArrowRight" ? 1 : -1));
    }
  });
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) viewer.close();
  });
  viewer.addEventListener("close", () => {
    document.body.classList.remove("photo-viewer-open");
    returnFocus?.focus({ preventScroll: true });
  });
}

const siteVideos = document.querySelectorAll("video");
siteVideos.forEach((video) => {
  video.addEventListener("play", () => siteVideos.forEach((other) => {
    if (other !== video) other.pause();
  }));
});
