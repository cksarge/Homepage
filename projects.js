/**
 * PROJECTS: the list of cards shown on the homepage.
 *
 * To add a project, copy one { ... } block, paste it into the list,
 * and change the values. Cards appear in the same order as this list
 * (add new ones at the bottom: this order is the "date added" sort),
 * except that featured projects always come first.
 *
 *   title   (required) Card heading.
 *   image   (required) Background image path, e.g. "images/my-game.png".
 *           Use a 1200×900 PNG (4:3, same shape as the cards).
 *   url     (required) Where the card goes when clicked (opens in the same tab).
 *           Must be https://…, http://…, or a path on this site.
 *   alt     (optional) Alt text for the image. Defaults to "Preview of <title>".
 *   featured (optional) true to pin the card to the top and give it a
 *           "featured" tag. Featured cards keep their order among themselves.
 */
const PROJECTS = [
  {
    title: "Four Kingdoms",
    image: "images/four-kingdoms.png",
    url: "https://fourkingdoms.carterscoding.com/",
  },
  {
    title: "OpenTomato",
    image: "images/opentomato.png",
    url: "https://opentomato.carterscoding.com/",
  },
  {
    title: "Mac Remapper",
    image: "images/mac-remapper.png",
    url: "https://macremapper.carterscoding.com/",
  },
  {
    title: "Ports of Plague",
    featured: true,
    image: "images/ports-of-plague.png",
    url: "https://portsofplague.carterscoding.com/",
  },
  {
    title: "ASCII Art Converter",
    image: "images/ascii-art-converter.png",
    url: "https://asciiartconverter.carterscoding.com/",
  },
  {
    title: "Seventy-Three",
    image: "images/seventy-three.png",
    url: "https://73.carterscoding.com/",
  },
  {
    title: "All In",
    featured: true,
    image: "images/all-in.png",
    url: "https://allin.carterscoding.com/",
  },
  {
    title: "Moodwave",
    image: "images/moodwave.png",
    url: "https://moodwave.carterscoding.com/",
  },
  {
    title: "Basketball Legends",
    image: "images/basketball-legends.png",
    url: "https://legends.carterscoding.com/",
  },
  {
    title: "Maze Generator",
    image: "images/maze-generator.png",
    url: "https://mazegenerator.carterscoding.com/",
  },
  {
    title: "Battle World",
    featured: true,
    image: "images/battle-world.png",
    url: "https://battleworld.carterscoding.com/",
  },
  {
    title: "Bad Advice Simulator",
    image: "images/bad-advice-simulator.png",
    url: "https://badadvicesim.carterscoding.com/",
  },
  {
    title: "Restaurant For Monsters",
    image: "images/restaurant-for-monsters.png",
    url: "https://monsters.carterscoding.com/",
  },
  {
    title: "Driftfield",
    image: "images/driftfield.png",
    url: "https://driftfield.carterscoding.com/",
  },
];
