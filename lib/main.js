// Load in dependencies
var assert = require('assert');
var cssesc = require('cssesc');
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

// Define selector constants
var SELECTORS = {
  info: {
    albumArtId: 'playerBarArt',
    albumSelector: '.player-album',
    artistId: 'player-artist',
    containerId: 'playerSongInfo',
    infoWrapperClass: 'now-playing-info-wrapper',
    titleId: 'currently-playing-title'
  },
  forward: {
    buttonSelector: '[data-id="forward"]'
  },
  playPause: {
    buttonSelector: '[data-id="play-pause"]',
    dataId: 'play-pause',
    playingClass: 'playing'
  },
  rating: {
    // DEV: `.player-rating-container` doesn't exist until a song is playing
    containerSelector: '#playerSongInfo',
    thumbsSelector: '#player .player-rating-container [icon^="sj:thumb-"][data-rating]',
    thumbsUpSelector: '#player .player-rating-container [icon^="sj:thumb-"][data-rating="5"]',
    thumbsDownSelector: '#player .player-rating-container [icon^="sj:thumb-"][data-rating="1"]',
    thumbSelectorFormat: '#player .player-rating-container [icon^="sj:thumb-"][data-rating="{rating}"]'
  },
  repeat: {
    dataId: 'repeat',
    buttonSelector: '[data-id="repeat"]'
  },
  rewind: {
    buttonSelector: '[data-id="rewind"]'
  },
  shuffle: {
    dataId: 'shuffle',
    buttonSelector: '[data-id="shuffle"]'
  },
  playback: {
    sliderId: 'material-player-progress'
  },
  queue: {
    clearButton: '[data-id="clear-queue"]',
    container: '#queue-overlay',
    songs: '.queue-song-table tbody > .song-row',
    triggerButton: '#queue[data-id="queue"]'
  },
  volume: {
    sliderId: 'material-vslider'
  }
};

// Define bind method
function bind(context, fn) {
  return function bindFn () {
    return fn.apply(context, arguments);
  };
}

function dispatchEvent (el, etype) {
  var evt = document.createEvent('Events');
  evt.initEvent(etype, true, false);
  el.dispatchEvent(evt);
}

// Define our constructor
function GMusic(win) {
  // If win was not provided, complain
  if (!win) {
    throw new Error('`win` was not provided to the `GMusic` constructor');
  }

  // Inherit from EventEmitter
  EventEmitter.call(this);

  // Localize reference to window and document
  this.win = win;
  this.doc = win.document;

  // For each of the prototype sections
  var proto = GMusic._protoObj;
  for (var protoKey in proto) {
    if (proto.hasOwnProperty(protoKey)) {
      // Define a key on our object
      this[protoKey] = {};

      // For each of the keys on the section, define a function that invokes on this original context
      var section = proto[protoKey];
      for (var sectionKey in section) {
        if (section.hasOwnProperty(sectionKey)) {
          this[protoKey][sectionKey] = bind(this, section[sectionKey]);
        }
      }

      // If there was an `init` method, run it
      if (this[protoKey].init) {
        this[protoKey].init();
      }
    }
  }
}
// Inherit from EventEmitter normally
inherits(GMusic, EventEmitter);

// Define a "prototype" that will have magical invocation
var proto = GMusic._protoObj = {};

// Create a volume API
proto.volume = {
  // Query required elements
  init: function () {
    this.volume._sliderEl = this.doc.getElementById(SELECTORS.volume.sliderId);
    assert(this.volume._sliderEl, 'Failed to find slider element for volume "#' + SELECTORS.volume.sliderId + '"');
  },

  // Get the current volume level.
  getVolume: function () {
    return parseInt(this.volume._sliderEl.getAttribute('aria-valuenow'), 10);
  },

  // Set the volume level (0 - 100).
  setVolume: function (vol) {
    var current = this.volume.getVolume();

    if (vol > current) {
      this.volume.increaseVolume(vol - current);
    } else if (vol < current) {
      this.volume.decreaseVolume(current - vol);
    }
  },

  // Increase the volume by an amount (default of 5)
  increaseVolume: function (amount) {
    if (amount === undefined) {
      amount = 5;
    }

    for (var i = 0; i < amount; i += 5) {
      this.volume._sliderEl.increment();
    }
  },

  // Decrease the volume by an amount (default of 1)
  decreaseVolume: function (amount) {
    if (amount === undefined) {
      amount = 5;
    }

    for (var i = 0; i < amount; i += 5) {
      this.volume._sliderEl.decrement();
    }
  }
};

// Create a playback API and constants
GMusic.Playback = {
  // Playback states
  STOPPED: 0,
  PAUSED: 1,
  PLAYING: 2,

  // Repeat modes
  LIST_REPEAT: 'LIST_REPEAT',
  SINGLE_REPEAT: 'SINGLE_REPEAT',
  NO_REPEAT: 'NO_REPEAT',

  // Shuffle modes
  ALL_SHUFFLE: 'ALL_SHUFFLE',
  NO_SHUFFLE: 'NO_SHUFFLE'
};
proto.playback = {
  // Query references to the media playback elements
  init: function () {
    var _sliderEl = this.playback._sliderEl = this.doc.getElementById(SELECTORS.playback.sliderId);
    var _playPauseEl = this.playback._playPauseEl = this.doc.querySelector(SELECTORS.playPause.buttonSelector);
    var _forwardEl = this.playback._forwardEl = this.doc.querySelector(SELECTORS.forward.buttonSelector);
    var _rewindEl = this.playback._rewindEl = this.doc.querySelector(SELECTORS.rewind.buttonSelector);
    var _shuffleEl = this.playback._shuffleEl = this.doc.querySelector(SELECTORS.shuffle.buttonSelector);
    var _repeatEl = this.playback._repeatEl = this.doc.querySelector(SELECTORS.repeat.buttonSelector);

    assert(_sliderEl, 'Failed to find slider element for playback "#' + SELECTORS.playback.sliderId + '"');
    assert(_playPauseEl, 'Failed to find playPause element for playback "' + SELECTORS.playPause.buttonSelector + '"');
    assert(_forwardEl, 'Failed to find forward element for playback "' + SELECTORS.forward.buttonSelector + '"');
    assert(_rewindEl, 'Failed to find rewind element for playback "' + SELECTORS.rewind.buttonSelector + '"');
    assert(_shuffleEl, 'Failed to find shuffle element for playback "' + SELECTORS.shuffle.buttonSelector + '"');
    assert(_repeatEl, 'Failed to find repeat element for playback "' + SELECTORS.repeat.buttonSelector + '"');
  },

  // Time functions
  getPlaybackTime: function () {
    return parseInt(this.playback._sliderEl.getAttribute('aria-valuenow'), 10);
  },

  setPlaybackTime: function (milliseconds) {
    // Set playback value on the element and trigger a change event
    this.playback._sliderEl.value = milliseconds;
    var evt = new this.win.UIEvent('change');
    this.playback._sliderEl.dispatchEvent(evt);
  },

  // Playback functions
  playPause: function () { this.playback._playPauseEl.click(); },
  forward: function () { this.playback._forwardEl.click(); },
  rewind: function () { this.playback._rewindEl.click(); },

  getShuffle: function () {
    var title = this.playback._shuffleEl.getAttribute('title').toLowerCase();
    if (title.indexOf('off') !== -1) {
      return GMusic.Playback.ALL_SHUFFLE;
    } else {
      return GMusic.Playback.NO_SHUFFLE;
    }
  },
  toggleShuffle: function () { this.playback._shuffleEl.click(); },

  getRepeat: function () {
    var title = this.playback._repeatEl.getAttribute('title').toLowerCase();
    if (title.indexOf('repeat off') !== -1) {
      return GMusic.Playback.NO_REPEAT;
    } else if (title.indexOf('repeating all') !== -1) {
      return GMusic.Playback.LIST_REPEAT;
    } else {
      return GMusic.Playback.SINGLE_REPEAT;
    }
  },

  toggleRepeat: function (mode) {
    if (!mode) {
      // Toggle between repeat modes once
      this.playback._repeatEl.click();
    } else {
      // Toggle between repeat modes until the desired mode is activated
      while (this.playback.getRepeat() !== mode) {
        this.playback._repeatEl.click();
      }
    }
  },

  // Taken from the Google Play Music page
  toggleVisualization: function () {
    this.win.SJBpost('toggleVisualization');
  }
};

// Create a queue API
proto.queue = {
  _render: function (container, force) {
    // DEV: The queue isn't rendered till a click event is fired on this element
    //      We must hide the queue during the 400ms animation and then reveal it
    //      once both the 400ms in and 400ms out animations are complete
    var table = container.querySelector('.queue-song-table');
    if (container.style.display === 'none' && (!table || force)) {
      // DEV: Hide the queue elements while we rapidly "render" the queue element
      //      We have to use a style element because inline styles are saved by GPM
      var style = document.createElement('style');
      style.innerHTML = SELECTORS.queue.container + '{left: 10000px !important}';
      document.body.appendChild(style);

      // Render queue
      dispatchEvent(document.querySelector(SELECTORS.queue.triggerButton), 'click');
      setTimeout(function () {
        // Return queue to intitial state
        dispatchEvent(document.querySelector(SELECTORS.queue.triggerButton), 'click');
        // Set interval in this cased is less resource intensive than running a MutationObserver for about 20ms
        var waitForQueueToHide = setInterval(function () {
          if (container.style.display === 'none') {
            clearInterval(waitForQueueToHide);
            document.body.removeChild(style);
          }
        }, 2);
      }.bind(this), 20);
    }
  },

  clear: function (cb) {
    var clearButton = this.doc.querySelector(SELECTORS.queue.container + ' ' + SELECTORS.queue.clearButton);
    if (clearButton) {
      clearButton.click();
      setTimeout(function reRenderQueue () {
        this.queue._render(this.doc.querySelector(SELECTORS.queue.container), true);
        if (cb) {
          cb();
        }
      }.bind(this), 200);
    } else if (cb) {
      cb();
    }
  },

  getSongs: function () {
    var container = this.doc.querySelector(SELECTORS.queue.container);
    this.queue._render(container);

    return Array.prototype.slice.call(
      container.querySelectorAll(SELECTORS.queue.songs)
    ).map(function mapRowToSong (row) {
      var timeString = row.querySelector('[data-col="duration"]').textContent.trim().split(':');
      var details = row.querySelector('.song-details-wrapper');
      var defaultString = {
        textContent: null
      };
      var songObject = {
        id: row.getAttribute('data-id'),
        title: (details.querySelector('.song-title') || defaultString).textContent,
        artist: (details.querySelector('.song-artist') || defaultString).textContent,
        album: (details.querySelector('.song-album') || defaultString).textContent,
        art: row.querySelector('[data-col="song-details"] img').src.replace('=s60-e100-c', ''),
        duration: 1000 * (parseInt(timeString[0], 10) * 60 + parseInt(timeString[1], 10)),
        playing: row.classList.contains('currently-playing')
      };
      return songObject;
    });
  },

  playSong: function (id) {
    var escapedId =  cssesc(id, {
      quotes: 'double'
    });
    var songRow = this.doc.querySelector('[data-id="' + escapedId + '"]');
    assert(songRow, 'Failed to find song with ID: ' + escapedId);
    songRow.querySelector('[data-id="play"]').click();
  }
};

// Create a rating API
proto.rating = {
  // Determine if a thumb is selected or not
  _isElSelected: function (el) {
    // If the target is "Undo"-able, then it's selected
    // jscs:disable maximumLineLength
    // Unselected thumbs down:
    // <paper-icon-button icon="sj:thumb-up-outline" data-rating="5" role="button" tabindex="0" aria-disabled="false" class="x-scope paper-icon-button-0" title="Thumb-up" aria-label="Thumb-up"></paper-icon-button>
    // Selected thumbs up:
    // <paper-icon-button icon="sj:thumb-up-outline" data-rating="5" role="button" tabindex="0" aria-disabled="false" class="x-scope paper-icon-button-0" title="Undo thumb-up" aria-label="Undo thumb-up"></paper-icon-button>
    // jscs:enable maximumLineLength
    return el.getAttribute('aria-label').indexOf('Undo') !== -1;
  },
  // Get current rating
  getRating: function () {
    var thumbEls = this.doc.querySelectorAll(SELECTORS.rating.thumbsSelector);
    assert(thumbEls.length, 'Failed to find thumb elements for rating "' + SELECTORS.rating.thumbsSelector + '"');
    var i = 0;
    var len = thumbEls.length;
    for (; i < len; i++) {
      var el = thumbEls[i];
      if (this.rating._isElSelected(el)) {
        return el.dataset.rating;
      }
    }
    return '0';
  },

  // Thumbs up
  toggleThumbsUp: function () {
    var el = this.doc.querySelector(SELECTORS.rating.thumbsUpSelector);

    if (el) {
      el.click();
    }
  },

  // Thumbs down
  toggleThumbsDown: function () {
    var el = this.doc.querySelector(SELECTORS.rating.thumbsDownSelector);

    if (el) {
      el.click();
    }
  },

  // Set a rating
  setRating: function (rating) {
    var selector = SELECTORS.rating.thumbSelectorFormat.replace('{rating}', rating);
    var el = this.doc.querySelector(selector);

    if (el && !this.rating._isElSelected(el)) {
      el.click();
    }
  },

  // Reset the rating
  resetRating: function () {
    var selector = SELECTORS.rating.thumbSelectorFormat.replace('{rating}', this.rating.getRating());
    var el = this.doc.querySelector(selector);

    if (el && this.rating._isElSelected(el)) {
      el.click();
    }
  }
};

// Miscellaneous functions
proto.extras = {
  // Get a shareable URL of the song on Google Play Music
  getSongURL: function () {
    var albumEl = this.doc.querySelector('.player-album');
    var artistEl = this.doc.querySelector('.player-artist');

    var urlTemplate = 'https://play.google.com/music/m/';
    var url = null;

    var parseID = function (id) {
      return id.substring(0, id.indexOf('/'));
    };

    if (albumEl === null && artistEl === null) {
      return null;
    }

    var albumId = parseID(albumEl.dataset.id);
    var artistId = parseID(artistEl.dataset.id);

    if (albumId) {
      url = urlTemplate + albumId;
    } else if (artistId) {
      url = urlTemplate + artistId;
    }

    return url;
  }
};

proto.hooks = {
  init: function () {
    // Save context for bindings
    var that = this;

    // Define mutation observer for reuse
    var MutationObserver = this.win.MutationObserver || this.win.WebKitMutationObserver;

    var lastTitle = '';
    var lastArtist = '';
    var lastAlbum = '';

    var addObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        for (var i = 0; i < m.addedNodes.length; i++) {
          // DEV: We can encounter a text node, verify we have a `classList` to assert against
          var target = m.addedNodes[i];
          if (target.classList && target.classList.contains(SELECTORS.info.infoWrapperClass)) {
            var title = that.doc.getElementById(SELECTORS.info.titleId);
            var artist = that.doc.getElementById(SELECTORS.info.artistId);
            var album = that.doc.querySelector(SELECTORS.info.albumSelector);
            var art = that.doc.getElementById(SELECTORS.info.albumArtId);
            var durationStr = that.doc.getElementById(SELECTORS.playback.sliderId).getAttribute('aria-valuemax');
            var duration = parseInt(durationStr, 10);

            title = (title) ? title.textContent : 'Unknown';
            artist = (artist) ? artist.textContent : 'Unknown';
            album = (album) ? album.textContent : 'Unknown';
            art = (art) ? art.src : null;

            // The art may be a protocol-relative URL, so normalize it to HTTPS
            if (art && art.slice(0, 2) === '//') {
              art = 'https:' + art;
            }

            // Make sure that this is the first of the notifications for the
            // insertion of the song information elements.
            if (lastTitle !== title || lastArtist !== artist || lastAlbum !== album) {
              that.emit('change:song', {
                title: title,
                artist: artist,
                album: album,
                art: art,
                duration: duration
              });

              lastTitle = title;
              lastArtist = artist;
              lastAlbum = album;
            }
          }
        }
      });
    });

    var lastShuffle;
    var shuffleObserver = new MutationObserver(function (mutations) {
      var shuffleTouched = mutations.some(function (m) {
        var target = m.target;
        return target.dataset.id === SELECTORS.shuffle.dataId;
      });

      if (!shuffleTouched) {
        return;
      }

      var newShuffle = that.playback.getShuffle();
      if (lastShuffle !== newShuffle) {
        lastShuffle = newShuffle;
        that.emit('change:shuffle', newShuffle);
      }
    });

    var lastRepeat;
    var repeatObserver = new MutationObserver(function (mutations) {
      var repeatTouched = mutations.some(function (m) {
        var target = m.target;
        return target.dataset.id === SELECTORS.repeat.dataId;
      });

      if (!repeatTouched) {
        return;
      }

      var newRepeat = that.playback.getRepeat();
      if (lastRepeat !== newRepeat) {
        lastRepeat = newRepeat;
        that.emit('change:repeat', newRepeat);
      }
    });

    var lastMode;
    var playbackObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        var target = m.target;
        var id = target.dataset.id;

        if (id === SELECTORS.playPause.dataId) {
          // If the play/pause button is disabled
          var mode;
          if (target.disabled === true) {
            // If there is song info, then we are transitioning songs and do nothing
            if (that.doc.getElementById(SELECTORS.info.containerId).style.display !== 'none') {
              return;
            // Otherwise, we are stopped
            } else {
              mode = GMusic.Playback.STOPPED;
            }
          // Otherwise (the play/pause button is enabled)
          } else {
            var playing = target.classList.contains(SELECTORS.playPause.playingClass);
            if (playing) {
              mode = GMusic.Playback.PLAYING;
            // DEV: If this fails to catch stopped cases, then maybe move "no song info" check to top level
            } else {
              mode = GMusic.Playback.PAUSED;
            }
          }

          // If the mode has changed, then update it
          if (mode !== lastMode) {
            that.emit('change:playback', mode);
            lastMode = mode;
          }
        }
      });
    });

    var playbackTimeObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        var target = m.target;
        var id = target.id;

        if (id === SELECTORS.playback.sliderId) {
          var currentTime = parseInt(target.getAttribute('aria-valuenow'), 10);
          var totalTime = parseInt(target.getAttribute('aria-valuemax'), 10);
          that.emit('change:playback-time', {current: currentTime, total: totalTime});
        }
      });
    });

    var lastRating;
    var ratingObserver = new MutationObserver(function (mutations) {
      // If we are looking at a rating button and it's selected, emit a notification
      // DEV: Prevent selection of container and "remove-circle-outline" button
      // jscs:disable maximumLineLength
      // Good:
      //   <paper-icon-button icon="sj:thumb-up-outline" data-rating="5" role="button" tabindex="0" aria-disabled="false" class="x-scope paper-icon-button-0" title="Thumb-up" aria-label="Thumb-up"></paper-icon-button>
      // Bad:
      //   <div id="playerSongInfo" style=""></div>
      //   <paper-icon-button icon="remove-circle-outline" data-rating="0" role="button" tabindex="0" aria-disabled="false" class="x-scope paper-icon-button-0"></paper-icon-button>
      // jscs:enable maximumLineLength
      var ratingsTouched = mutations.some(function (m) {
        // Determine if our ratings were touched
        var target = m.target;
        return target.dataset && target.dataset.rating && target.hasAttribute('aria-label');
      });

      if (!ratingsTouched) {
        return;
      }

      var newRating = that.rating.getRating();
      if (lastRating !== newRating) {
        lastRating = newRating;
        that.emit('change:rating', newRating);
      }
    });

    var lastQueue = [];
    var queueObserver = new MutationObserver(function (mutations) {
      var newQueue = that.queue.getSongs.call(that);
      var changed = false;

      function checkSongs(lastItem, newItem) {
        Object.keys(newItem).forEach(function checkKey (key) {
          if (newItem[key] !== lastItem[key]) {
            changed = true;
          }
        });
      }

      for (var i = 0; i < newQueue.length; i++) {
        if (!lastQueue[i]) {
          changed = true;
          break;
        }
        checkSongs(lastQueue[i], newQueue[i]);
      }

      if (changed) {
        lastQueue = newQueue;
        that.emit('change:queue', newQueue);
      }
    });

    // Find our target elements
    var addObserverEl = this.doc.getElementById(SELECTORS.info.containerId);
    var shuffleObserverEl = this.doc.querySelector(SELECTORS.shuffle.buttonSelector);
    var repeatObserverEl = this.doc.querySelector(SELECTORS.repeat.buttonSelector);
    var playbackObserverEl = this.doc.querySelector(SELECTORS.playPause.buttonSelector);
    var playbackTimeObserverEl = this.doc.getElementById(SELECTORS.playback.sliderId);
    var ratingObserverEl = this.doc.querySelector(SELECTORS.rating.containerSelector);
    var queueObserverEl = this.doc.querySelector(SELECTORS.queue.container);

    // Verify they exist
    // jscs:disable maximumLineLength
    assert(addObserverEl, 'Failed to find addObserver element for hooks "#' + SELECTORS.info.containerId + '"');
    assert(shuffleObserverEl, 'Failed to find shuffleObserver element for hooks "' + SELECTORS.shuffle.buttonSelector + '"');
    assert(repeatObserverEl, 'Failed to find repeatObserver element for hooks "' + SELECTORS.repeat.buttonSelector + '"');
    assert(playbackObserverEl, 'Failed to find playbackObserver element for hooks "' + SELECTORS.playPause.buttonSelector + '"');
    assert(playbackTimeObserverEl, 'Failed to find playbackTimeObserver element for hooks "#' + SELECTORS.playback.sliderId + '"');
    assert(ratingObserverEl, 'Failed to find ratingObserver element for hooks "' + SELECTORS.rating.containerSelector + '"');
    assert(queueObserverEl, 'Failed to find queueObserver element for hooks "' + SELECTORS.queue.container + '"');
    // jscs:enable maximumLineLength

    // Bind our elements
    addObserver.observe(addObserverEl, {
      childList: true,
      subtree: true
    });
    shuffleObserver.observe(shuffleObserverEl, {
      attributes: true
    });
    repeatObserver.observe(repeatObserverEl, {
      attributes: true
    });
    playbackObserver.observe(playbackObserverEl, {
      attributes: true
    });
    playbackTimeObserver.observe(playbackTimeObserverEl, {
      attributes: true
    });
    ratingObserver.observe(ratingObserverEl, {
      attributes: true,
      subtree: true
    });
    queueObserver.observe(queueObserverEl, {
      childList: true,
      subtree: true
    });
  }
};

// Expose selectors as a class property
GMusic.SELECTORS = SELECTORS;

// Export our constructor
module.exports = GMusic;
