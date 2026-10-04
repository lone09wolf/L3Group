const mediaRoot = document.body.dataset.root || "";
const sitePhotos = [
  [1, "building", "Multi-storey masonry exterior"],
  [2, "building", "Building courtyard and material staging"],
  [3, "building", "Masonry elevations and window openings"],
  [4, "building", "Construction team working on blockwork"],
  [5, "building", "Roof framing above a masonry structure"],
  [6, "building", "Side elevation of the building works"],
  [7, "building", "Construction crew beneath roof framing"],
  [8, "building", "Building courtyard with the site team"],
  [9, "building", "Masonry structure viewed from the street"],
  [10, "residential", "White residential exterior with a red front door"],
  [11, "residential", "Residential facade and landscaped entrance"],
  [12, "residential", "Residential street and finished exterior details"],
  [13, "residential", "Double-storey home during masonry work"],
  [14, "residential", "Residential structures across the site"],
  [15, "residential", "Masonry homes and prepared access routes"],
  [16, "residential", "Residential blockwork taking shape"],
  [17, "residential", "View across a residential courtyard"],
  [18, "residential", "Residential facades viewed from an upper floor"],
  [19, "residential", "Exterior finishing work in a residential setting"],
  [20, "residential", "Residential street and boundary walls"],
  [21, "residential", "Corner home and surrounding boundary wall"],
  [22, "residential", "Street-level view of homes during construction"],
  [23, "civil", "Aerial overview of site preparation"],
  [24, "civil", "Overhead view of earthworks and access routes"],
  [25, "civil", "Aerial view of the prepared construction site"],
  [26, "civil", "Site layout viewed from above"],
  [27, "civil", "Groundwork within the site boundary"],
  [28, "civil", "Heavy machinery on the earthworks site"],
  [29, "civil", "Excavation and ground preparation"],
  [30, "civil", "Road roller on prepared ground"],
  [31, "civil", "Machinery and cleared construction ground"],
  [32, "civil", "Grader working on the site surface"],
  [33, "civil", "Grader alongside prepared earthworks"],
  [34, "civil", "Site crew coordinating with heavy machinery"],
  [35, "civil", "Water truck beside the prepared ground"],
  [36, "civil", "Grading and ground preparation in progress"],
  [37, "civil", "Water tanker crossing the earthworks site"],
  [38, "civil", "Water tanker and site activity"],
  [39, "civil", "Excavator working beside a foundation trench"],
].map(([id, category, caption]) => ({ id: String(id).padStart(2, "0"), category, caption }));

const photoPath = (photo, size) => `${mediaRoot}assets/site-media/photo-${photo.id}-${size}.webp`;
const galleryLinks = [];
document.querySelectorAll("[data-photo-gallery]").forEach((gallery) => {
  const photographs = sitePhotos.filter((photo) => photo.category === gallery.dataset.photoGallery);
  photographs.forEach((photo) => {
    const figure = document.createElement("figure");
    const link = document.createElement("a");
    link.className = "photo-gallery__link";
    link.href = photoPath(photo, 1600);
    link.setAttribute("aria-label", `View photo: ${photo.caption}`);
    const image = document.createElement("img");
    image.src = photoPath(photo, 480);
    image.alt = photo.caption;
    image.loading = "lazy";
    image.decoding = "async";
    const caption = document.createElement("figcaption");
    caption.textContent = photo.caption;
    link.append(image);
    figure.append(link, caption);
    gallery.append(figure);
    galleryLinks.push({ link, photo });
  });
});

if (galleryLinks.length) {
  const viewer = document.createElement("dialog");
  viewer.className = "photo-viewer";
  viewer.setAttribute("aria-label", "Project photo viewer");
  viewer.innerHTML = `<div class="photo-viewer__bar"><p data-viewer-counter aria-live="polite"></p><button type="button" class="photo-viewer__close" aria-label="Close photo viewer" title="Close photo viewer">&#215;</button></div><div class="photo-viewer__stage"><button type="button" data-viewer-prev aria-label="Previous photo" title="Previous photo"><img src="${mediaRoot}assets/chevron-left.svg" alt="" /></button><img class="photo-viewer__image" alt="" /><button type="button" data-viewer-next aria-label="Next photo" title="Next photo"><img src="${mediaRoot}assets/chevron-right.svg" alt="" /></button></div><p class="photo-viewer__caption"></p>`;
  document.body.append(viewer);
  let activePhoto = 0;
  let returnFocus;
  const showPhoto = (index) => {
    activePhoto = (index + galleryLinks.length) % galleryLinks.length;
    const { photo } = galleryLinks[activePhoto];
    const image = viewer.querySelector(".photo-viewer__image");
    image.src = photoPath(photo, 1600);
    image.alt = photo.caption;
    viewer.querySelector("[data-viewer-counter]").textContent = `${activePhoto + 1} / ${galleryLinks.length}`;
    viewer.querySelector(".photo-viewer__caption").textContent = photo.caption;
  };
  galleryLinks.forEach(({ link }, index) => {
    link.addEventListener("click", (event) => {
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
