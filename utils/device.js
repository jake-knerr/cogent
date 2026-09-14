// Last reviewed 9.10.26

/**
 * @typedef {object} DeviceMetrics
 * @prop {"desktop"|"mobile"} deviceType A tablet is mobile; there is no third
 *  answer.
 * @prop {"blink"|"gecko"|"other"|"webkit"} engine The rendering engine, for
 *  branching where a bug belongs to the engine rather than the brand. Safari
 *  and every ios browser are webkit.
 * @prop {string} language The one the browser prefers, as a BCP 47 tag such as
 *  `en-US`. Cased as the tag is written rather than lowered, since that is what
 *  every reader of one expects.
 * @prop {"android"|"chromeos"|"ios"|"linux"|"mac"|"other"|"windows"} os The
 *  platform, as one name.
 * @prop {number} pixelRatio `devicePixelRatio` at first read. Browser zoom
 *  moves it, so treat it as the density at load rather than a constant.
 * @prop {number} screenHeight The display, not the window. Follows the current
 *  orientation, so on a phone it is whichever way up the device was at load.
 * @prop {number} screenWidth As `screenHeight`.
 * @prop {boolean} touchSupport
 */

/** @type {DeviceMetrics|undefined} */
let deviceMetrics;

/**
 * What device this is running on, browser included -- half of it describes
 * hardware, which is why it is not called a browser. Read once and cached.
 *
 * @returns {DeviceMetrics}
 */
export function getDeviceMetrics() {
  if (deviceMetrics) return deviceMetrics;

  // cached rather than live: this answers what the device is, not what the
  // window is doing. The screen dimensions and the pixel ratio are the ones that
  // can move -- on rotation and on browser zoom -- and they stay as they were at
  // first read, which is what identifying a visit wants.
  //
  // The viewport is deliberately absent for the same reason. It changes on
  // every resize, on a url bar collapsing, and on a keyboard opening, so
  // measure it where it is needed rather than caching a number that is wrong a
  // moment later
  const { platform, vendor, userAgent, maxTouchPoints, language } = navigator;

  // an ipad defaults to desktop mode, where the agent says Macintosh and
  // carries neither iPad nor Mobile/ -- so nothing in the string separates it
  // from a mac. Touch points do: a mac reports 0
  const iPad = platform === "MacIntel" && maxTouchPoints > 1;

  const ios =
    iPad ||
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent));

  // every version in an agent string is now frozen for fingerprinting reasons
  // -- chrome reports `Android 10` on every android and `Intel Mac OS X
  // 10_15_7` on every mac -- so each of these is read as a presence and never
  // as a number
  const android = /Android \d/.test(userAgent);
  const chrome = /Chrome\/\d/.test(userAgent);
  const mac = /Mac/.test(platform) && !iPad;
  const webkit = /Apple Computer/.test(vendor);

  deviceMetrics = {
    deviceType:
      iPad || /Android|Mobile|iPhone|iPad/i.test(userAgent)
        ? "mobile"
        : "desktop",
    engine: getEngine({ webkit, chrome, userAgent }),
    language,
    os: getOS({ android, ios, mac, userAgent }),
    pixelRatio: devicePixelRatio,
    screenHeight: screen.height,
    screenWidth: screen.width,
    touchSupport: maxTouchPoints > 0 || "ontouchstart" in window,
  };

  return deviceMetrics;
}

function getEngine({ webkit, chrome, userAgent }) {
  // no token in an agent string names an engine: every chromium browser carries
  // `AppleWebKit/537.36 (KHTML, like Gecko)`, so both halves of that are a lie.
  // The vendor is what actually separates them.
  //
  // Webkit first, because apple requires WKWebView on ios -- chrome and firefox
  // there are webkit however they are branded
  if (webkit) return "webkit";
  if (chrome) return "blink";

  // `Gecko/<digits>` is firefox and only firefox; the `like Gecko` every
  // chromium agent carries has no slash after it
  if (/Gecko\/\d/.test(userAgent)) return "gecko";

  return "other";
}

function getOS({ android, ios, mac, userAgent }) {
  // the mobile three come from checks that have already done what an agent
  // string cannot -- an ipad in desktop mode among them. The rest have none, so
  // the agent is all there is.
  //
  // Order carries it: android names Linux and a chromebook names X11, so the
  // specific answers are spent before the general ones
  if (ios) return "ios";
  if (android) return "android";
  if (mac) return "mac";
  if (/CrOS/.test(userAgent)) return "chromeos";
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Linux|X11/i.test(userAgent)) return "linux";

  return "other";
}
