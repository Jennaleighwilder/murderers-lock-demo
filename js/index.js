(function () {
  'use strict';
  function toggleFAQ(button) {
    const item = button.parentElement;
    const wasActive = item.classList.contains('active');
    document.querySelectorAll('.faq-item').forEach(function (faq) { faq.classList.remove('active'); });
    if (!wasActive) item.classList.add('active');
  }
  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.addEventListener('click', function () { toggleFAQ(btn); });
  });
})();
