/* -------------------------------------------------------------
   MY LOOM // CUSTOM CURSOR TRACKER (Fixed widgets, no parallax shifts)
   ------------------------------------------------------------- */

export function initCursorAndParallax() {
  const cursorDot = document.getElementById('cursor-dot');
  const cursorRing = document.getElementById('cursor-ring');
  
  if (!cursorDot || !cursorRing) return;

  let mouse = { x: -100, y: -100 }; // Current coordinates
  let ringPos = { x: -100, y: -100 }; // Follower lag coordinates

  // Move custom cursor elements
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    
    // Position dot immediately
    cursorDot.style.left = `${mouse.x}px`;
    cursorDot.style.top = `${mouse.y}px`;
  });

  // Outer ring interpolation follow loop
  function animateRing() {
    const lerpWeight = 0.15;
    ringPos.x += (mouse.x - ringPos.x) * lerpWeight;
    ringPos.y += (mouse.y - ringPos.y) * lerpWeight;
    
    cursorRing.style.left = `${ringPos.x}px`;
    cursorRing.style.top = `${ringPos.y}px`;
    
    requestAnimationFrame(animateRing);
  }
  requestAnimationFrame(animateRing);

  // Bind hover triggers to expand follower ring on active UI selectors
  function updateHoverListeners() {
    const clickables = document.querySelectorAll(
      'a, button, select, input, textarea, .dropzone, .task-row-interactive, .tag, .status-cell, .tab-btn'
    );
    
    clickables.forEach(elem => {
      if (elem.dataset.cursorBound) return;
      elem.dataset.cursorBound = 'true';

      elem.addEventListener('mouseenter', () => {
        document.body.classList.add('cursor-hover');
      });
      
      elem.addEventListener('mouseleave', () => {
        document.body.classList.remove('cursor-hover');
      });
    });
  }

  // Observer to capture dynamically loaded items
  const observer = new MutationObserver(() => {
    updateHoverListeners();
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  updateHoverListeners(); // Initial bind
}
