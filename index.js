require("@babel/register")({
  ignore: [/(node_modules)/],
  presets: ["@babel/preset-env", "@babel/preset-react"],
  plugins: ["babel-plugin-jsx-control-statements"],
});
require("babel-polyfill");

/*
A sample session:
👩🏽‍💻 user/search: q: Greg
  📨 goog/msg/header: subject: Friday gig
  📨 goog/msg/header: subject: Great jam
    📨 goog/msg/body: subject: Friday gig, att: []
    📨 goog/msg/body: subject: Great jam, att: [jam.mp3, jam2.mp3]
    📨 goog/att/id: att: jam.mp3
    📨 goog/att/id: att: jam2.mp3
  🛰 net/att/start: att: jam.mp3
  🛰 net/att/finish: att: jam.mp3, bytes: ed5e27a...
🔊 player/play: att: jam.mp3, bytes: ed5e27a...
  🛰 net/att/start: att: jam2.mp3
  🛰 net/att/finish: att: jam2.mp3, bytes: 4cd26f0...
🔊 player/complete: att: jam.mp3, bytes: ed5e27a...
🔊 player/play: att: jam2.mp3, bytes: 4cd26f0...
🔊 player/complete: att: jam2.mp3, bytes: 4cd26f0...

*/
const { channel } = require("polyrhythm");
const { format, indent } = require("./format");

let implementation;

if (process.env.DEMO === "1") {
  implementation = require("./implementations/stub");
} else {
  implementation = require("./implementations/real");
}

const {
  getMatchingMsgHeadersFromSearch,
  getAudioAttachments,
  downloadAttachment,
  playFinishedAttachment,
} = implementation;

const { props, updateView } = require("./components/View");

// Log to an object
channel.filter(true, (event) => {
  props.logs.push(indent(event) + format(event));
});

channel.filter("player/play", ({ payload: { att } }) => {
  props.nowPlaying.title = att;
});
channel.filter("player/complete", ({ payload: { att } }) => {
  props.nowPlaying.title = "---";
});
channel.filter("goog/att/id", ({ payload: { att } }) => {
  props.queue = [...props.queue, { name: att, status: null }];
});
channel.filter("net/att/start", ({ payload: { att } }) => {
  props.queue.find((i) => i.name === att).status = "downloading";
});
channel.filter("net/att/finish", ({ payload: { att } }) => {
  props.queue.find((i) => i.name === att).status = "done";
});
channel.filter(true, updateView);

channel.on("user/search", getMatchingMsgHeadersFromSearch);

channel.on("goog/msg/header", getAudioAttachments);

// Option 1 - download attachments as you discover them (serially)
channel.on("goog/att/id", downloadAttachment, {
  mode: "serial",
});

// Option 2 - Limit how far you can get ahead using some RxJS magic
// const prePlays = n => from(Array(n));
// const downloads = zip(
//   channel.actionsOfType("goog/att/id"),
//   concat(prePlays(2), channel.actionsOfType("player/play")),
//   (att, _) => ({ action: att })
// ).pipe(concatMap(downloadAttachment));
// channel.subscribe(downloads);

channel.on("net/att/finish", playFinishedAttachment, {
  mode: "serial",
});

function start() {
  //require("clear")();
  const search = process.argv[2] || "wedding";
  const query = `${search} {filename:mp3 filename:wav filename:m4a}`;
  channel.trigger("user/search", { q: query });
  updateView();
}

// WHAT
// ----
// HOW

// DO IT!
start();
