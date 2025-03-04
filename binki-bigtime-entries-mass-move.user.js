// ==UserScript==
// @name     binki-bigtime-entries-mass-move
// @homepageURL https://github.com/binki/binki-bigtime-entries-mass-move
// @version  1.0.0
// @match https://intuit.bigtime.net/bigtime
// @match https://intuit.bigtime.net/bigtime/*
// @match https://intuit.bigtime.net/Bigtime
// @match https://intuit.bigtime.net/Bigtime/*
// @require https://github.com/binki/binki-userscript-when-element-query-selector-async/raw/0a9c204bdc304a9e82f1c31d090fdfdf7b554930/binki-userscript-when-element-query-selector-async.js
// @require https://github.com/binki/binki-userscript-delay-async/raw/252c301cdbd21eb41fa0227c49cd53dc5a6d1e58/binki-userscript-delay-async.js
// @require https://github.com/binki/binki-userscript-when-element-changed-async/raw/88cf57674ab8fcaa0e86bdf5209342ec7780739a/binki-userscript-when-element-changed-async.js
// @require https://github.com/binki/binki-userscript-when-event-dispatched-async/raw/0daa1c0c3501aeba7132d520aa8f389e0627aba6/binki-userscript-when-event-dispatched-async.js
// ==/UserScript==

(async () => {
  console.log('loaded');
  function testIfHrefIsDaily() {
    return /#\/timesheet\/daily\/\d+\/\d+$/.test(window.location.href);
  }
  while (true) {
    if (!testIfHrefIsDaily()) {
      await whenEventDispatchedAsync(window, 'hashchange');
      continue;
    }
    console.log('on daily timesheet screen');
  	const dailyPlannerDataUl = await whenElementQuerySelectorAsync(document.body, 'ul.DailyPlannerData');
    if (!testIfHrefIsDaily()) {
      continue;
    }
    const uiLi = document.createElement('li');
    const moveAllButton = document.createElement('button');
    moveAllButton.textContent = 'Move All';
    moveAllButton.type = 'button';
    moveAllButton.addEventListener('click', async () => {
      moveAllButton.disabled = true;
      try {
				const form = await whenElementQuerySelectorAsync(document.body, 'form[validation-object=selectedEntry]');
        const countEntries = () => dailyPlannerDataUl.querySelectorAll('li.entry').length;
        let entryCount = countEntries();
        const chosenDate = await (async () => {
          const entry = dailyPlannerDataUl.querySelector('li.entry');
          entry.click();
          const messageDiv = document.createElement('div');
          messageDiv.textContent = 'Choose the date and press Save to move all.';
          document.body.prepend(messageDiv);
          try {
            while (form.parentElement.classList.contains('ng-hide')) await whenElementChangedAsync(form);
            const saveButton = await whenElementQuerySelectorAsync(form, '.btn.btn-primary[ng-bind=saveDefaultTitle]');
            await whenEventDispatchedAsync(saveButton, 'click');
            const dateField = form.querySelector('input[input-date][ng-model="selectedEntry.Dt"]');
            const americanDateValue = dateField.value;
            // See issue #1: even though this is formatted as an American date and it works
            // because the date picker stores the selected date behind the scenes in state
            // somewhere, it isn’t possible to programmatically input this value when using
            // a non-American locale such as Korean or Japanese. So format it into the standard
            // format.
            const parts = /(\d+)\/(\d)+\/(\d+)/.exec(americanDateValue);
            return new Intl.DateTimeFormat('en-us', {
              calendar: 'iso8601',
            }).format(new Date(((new Date().getYear() + 1900) / 100 |0) * 100 + (parts[3]|0), parts[1] - 1, parts[2]));
          } finally {
            document.body.removeChild(messageDiv);
          }
        })();
        while (true) {
          // Wait for the previous thing to save.
          console.log(`waiting for entries to reduce from ${entryCount}`);
          while (countEntries() === entryCount) await whenElementChangedAsync(dailyPlannerDataUl);
          entryCount = countEntries();
          console.log(`now there are ${entryCount} entries`);
          // Apparently extra waiting is still necessary for some reason?
          const entry = dailyPlannerDataUl.querySelector('li.entry');
          if (!entry) {
            console.log('no more entries');
            break;
          }
          entry.click();
          console.log('clicked next');
          while (form.parentElement.classList.contains('ng-hide')) await whenElementChangedAsync(form.parentElement);
          const dateField = await whenElementQuerySelectorAsync(form, 'input[input-date][ng-model="selectedEntry.Dt"]');
          await delayAsync(10);
          dateField.value = chosenDate;
          dateField.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: chosenDate,
          }));
          (await whenElementQuerySelectorAsync(form, '.btn.btn-primary[ng-bind=saveDefaultTitle]')).click();
        }
      } finally {
        moveAllButton.disabled = false;
      }
    });
    uiLi.appendChild(moveAllButton);
    dailyPlannerDataUl.appendChild(uiLi);
    await whenEventDispatchedAsync(window, 'hashchange');
    dailyPlannerDataUl.removeChild(uiLi);
  }
})();
