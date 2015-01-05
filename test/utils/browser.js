// Load in dependencies
var assert = require('assert');
var fs = require('fs');
var async = require('async');
var wd = require('wd');

// Resolve cookies with helpful messaging
var cookiesJson;
try {
  cookiesJson = fs.readFileSync(__dirname + '/../cookies.json');
} catch (err) {
  throw new Error('Could not read `test/cookies.json`. Please make sure it exists. ' +
      'If it doesn\'t, follow the steps in https://github.com/twolfson/google-music.js#testing');
}
var cookies = JSON.parse(cookiesJson);

// Resolve the browser scripts
// https://github.com/kbhomes/radiant-player-mac/blob/83f3622977f7b4b3f451422f9b025b03fb385ad6/radiant-player-mac/AppDelegate.m#L874-L894
// TODO: Use bundled script instead of these one-offs
var scripts = [
  fs.readFileSync(__dirname + '/../lib/main.js', 'utf8'),
  fs.readFileSync(__dirname + '/../lib/keyboard.js', 'utf8'),
  fs.readFileSync(__dirname + '/../lib/mouse.js', 'utf8')
];

// Define helpers for interacting with the browser
exports.openMusic = function (options) {
  // Fallback our options and default URL
  options = options || {};
  var url = options.url || 'https://play.google.com/music/listen';

  // Execute many async steps
  before(function startBrowser () {
    this.browser = wd.remote();
  });
  before(function openBrowser (done) {
    this.browser.init({browserName: 'chrome'}, done);
  });
  before(function navigateToMusicBeforeLogin (done) {
    this.browser.get(url, done);
  });
  before(function handleLoginViaCookies (done) {
    var browser = this.browser;
    async.forEach(cookies, function setCookies (cookie, cb) {
      // If the cookie is not for .google.com, skip it
      if (cookie.domain !== '.google.com') {
        process.nextTick(cb);
      // Otherwise, set it
      } else {
        browser.setCookie(cookie, cb);
      }
    }, done);
  });
  before(function navigateToMusicAfterLogin (done) {
    this.browser.get(url, done);
  });
  before(function evalScripts (done) {
    var browser = this.browser;
    async.forEachSeries(scripts, function evalScript (script, cb) {
      browser.execute(script, cb);
    }, done);
  });

  // If we want to want to kill the session, clean it up
  // DEV: This is useful for inspecting state of a session
  var killBrowser = !options.dontKillBrowser;
  if (killBrowser) {
    after(function killBrowserFn (done) {
      var browser = this.browser;
      delete this.browser;
      browser.quit(done);
    });
  }
};
