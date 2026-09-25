/**
 * PROJECTS: the list of cards shown on the homepage.
 *
 * To add a project, copy one { ... } block, paste it into the list,
 * and change the values. Cards appear in the same order as this list.
 *
 *   title   (required) Card heading.
 *   image   (required) Background image path, e.g. "images/my-game.webp".
 *           Use 1200×900 (4:3, same shape as the cards).
 *   url     (required) Where the card goes when clicked (opens in the same tab).
 *   alt     (optional) Alt text for the image. Defaults to "Preview of <title>".
 */
const PROJECTS = [
  {
    title: "Four Kingdoms",
    image: "images/four-kingdoms.png",
    url: "https://cksarge.github.io/Four-Kingdoms/",
  },
  {
    title: "OpenTomato",
    image: "images/opentomato.png",
    url: "https://cksarge.github.io/OpenTomato/",
  },
  {
    title: "Mac Remapper",
    image: "images/mac-remapper.png",
    url: "https://cksarge.github.io/Mac-Remapper/",
  },
];
