(function () {
  'use strict';

  var root = document.querySelector('.desk-home');
  if (!root) return;

  var lastFocusedElement = null;
  var activeDialog = null;

  function getFocusable(container) {
    return Array.prototype.slice.call(container.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (element) {
      return !element.hasAttribute('hidden') && element.offsetParent !== null;
    });
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    dialog.setAttribute('hidden', '');
    document.body.classList.remove('desk-dialog-open');
    activeDialog = null;
    if (lastFocusedElement) lastFocusedElement.focus();
  }

  function openDialog(dialog) {
    if (!dialog) return;
    lastFocusedElement = document.activeElement;
    dialog.removeAttribute('hidden');
    document.body.classList.add('desk-dialog-open');
    activeDialog = dialog;
    var focusable = getFocusable(dialog);
    if (focusable.length) focusable[0].focus();
  }

  Array.prototype.forEach.call(root.querySelectorAll('[data-dialog-open]'), function (trigger) {
    trigger.addEventListener('click', function () {
      openDialog(document.getElementById(trigger.getAttribute('data-dialog-open')));
    });
  });

  Array.prototype.forEach.call(root.querySelectorAll('[data-dialog-close]'), function (trigger) {
    trigger.addEventListener('click', function () {
      closeDialog(trigger.closest('.desk-dialog'));
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (activeDialog) closeDialog(activeDialog);
      closeMusicCard();
      return;
    }

    if (event.key !== 'Tab' || !activeDialog) return;
    var focusable = getFocusable(activeDialog);
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  var musicToggle = document.getElementById('music-toggle');
  var musicCard = document.getElementById('music-card');

  function closeMusicCard() {
    if (!musicToggle || !musicCard || musicCard.hasAttribute('hidden')) return;
    musicCard.setAttribute('hidden', '');
    musicToggle.setAttribute('aria-expanded', 'false');
  }

  if (musicToggle && musicCard) {
    musicToggle.addEventListener('click', function () {
      var isOpen = !musicCard.hasAttribute('hidden');
      if (isOpen) {
        closeMusicCard();
      } else {
        musicCard.removeAttribute('hidden');
        musicToggle.setAttribute('aria-expanded', 'true');
      }
    });

    document.addEventListener('click', function (event) {
      if (!musicCard.hasAttribute('hidden') &&
          !musicCard.contains(event.target) &&
          !musicToggle.contains(event.target)) {
        closeMusicCard();
      }
    });
  }

  var photoDataElement = document.getElementById('desk-photo-data');
  var photoSlots = Array.prototype.slice.call(document.querySelectorAll('[data-photo-slot]'));
  var shuffleButton = document.getElementById('photo-shuffle');
  var photoData = [];
  var previousSelection = [];

  if (photoDataElement) {
    try {
      photoData = JSON.parse(photoDataElement.textContent);
    } catch (error) {
      photoData = [];
    }
  }

  previousSelection = photoSlots.map(function (slot) {
    var image = slot.querySelector('img');
    return { src: image ? image.getAttribute('src') : '' };
  });

  function shuffle(items) {
    var copy = items.slice();
    for (var index = copy.length - 1; index > 0; index -= 1) {
      var randomIndex = Math.floor(Math.random() * (index + 1));
      var temporary = copy[index];
      copy[index] = copy[randomIndex];
      copy[randomIndex] = temporary;
    }
    return copy;
  }

  function selectPhotos() {
    var selection = shuffle(photoData).slice(0, photoSlots.length);
    if (photoData.length > photoSlots.length && previousSelection.length &&
        selection.every(function (photo, index) { return photo.src === previousSelection[index]; })) {
      selection.push(selection.shift());
    }
    previousSelection = selection.slice();
    return selection;
  }

  function resetPhoto(slot) {
    slot.classList.remove('is-flipped');
    var toggle = slot.querySelector('.polaroid-toggle');
    var back = slot.querySelector('.polaroid-back');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (back) back.setAttribute('aria-hidden', 'true');
  }

  Array.prototype.forEach.call(photoSlots, function (slot) {
    var toggle = slot.querySelector('.polaroid-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
      var willFlip = !slot.classList.contains('is-flipped');
      slot.classList.toggle('is-flipped', willFlip);
      toggle.setAttribute('aria-expanded', willFlip ? 'true' : 'false');
      var back = slot.querySelector('.polaroid-back');
      if (back) back.setAttribute('aria-hidden', willFlip ? 'false' : 'true');
    });
  });

  if (shuffleButton && photoData.length >= photoSlots.length) {
    shuffleButton.addEventListener('click', function () {
      if (shuffleButton.disabled) return;
      shuffleButton.disabled = true;
      shuffleButton.classList.add('is-shuffling');

      Array.prototype.forEach.call(photoSlots, resetPhoto);
      window.setTimeout(function () {
        var selection = selectPhotos();
        Array.prototype.forEach.call(photoSlots, function (slot, index) {
          var photo = selection[index];
          var image = slot.querySelector('img');
          var caption = slot.querySelector('.polaroid-caption');
          var backLabel = slot.querySelector('.photo-back-label');
          var toggle = slot.querySelector('.polaroid-toggle');
          if (!photo) return;
          if (image) {
            image.src = photo.src;
            image.alt = '浅羽的摄影照片：' + photo.label;
          }
          if (caption) caption.textContent = photo.label;
          if (backLabel) backLabel.textContent = photo.label;
          if (toggle) toggle.setAttribute('aria-label', '翻转照片：' + photo.label);
        });
        shuffleButton.classList.remove('is-shuffling');
        shuffleButton.disabled = false;
      }, 180);
    });
  }
}());
