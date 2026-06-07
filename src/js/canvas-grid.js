/* -------------------------------------------------------------
   MY LOOM // INTERACTIVE CANVAS GRID BACKGROUND
   ------------------------------------------------------------- */

export function initCanvasGrid() {
  const canvas = document.getElementById('grid-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  const cellSize = 50; // Grid square cell resolution
  let mouse = { x: -1000, y: -1000 };

  // Mouse move listener
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // Reset coordinates if cursor leaves browser viewport
  document.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  // Handle canvas scaling on window resizing
  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // Rendering Loop
  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Identify current active theme
    const isLightMode = document.body.classList.contains('light-mode');

    // Draw Grid Lines
    const gridColor = isLightMode 
      ? 'rgba(201, 125, 78, 0.04)' 
      : 'rgba(201, 125, 78, 0.025)';
    
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < width; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < height; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Interactive highlights on mouse hover
    if (mouse.x >= 0 && mouse.y >= 0) {
      // 1. Math grid coordinates
      const cellX = Math.floor(mouse.x / cellSize) * cellSize;
      const cellY = Math.floor(mouse.y / cellSize) * cellSize;

      // Draw highlighted active cell box
      const activeCellFill = isLightMode
        ? 'rgba(201, 125, 78, 0.035)'
        : 'rgba(201, 125, 78, 0.02)';
      ctx.fillStyle = activeCellFill;
      ctx.fillRect(cellX, cellY, cellSize, cellSize);

      // Draw thin active cell border highlight
      const activeCellBorder = isLightMode
        ? 'rgba(201, 125, 78, 0.15)'
        : 'rgba(201, 125, 78, 0.08)';
      ctx.strokeStyle = activeCellBorder;
      ctx.strokeRect(cellX, cellY, cellSize, cellSize);

      // 2. Diffuse terracotta radial glow overlay
      const radialGlow = 250;
      const gradient = ctx.createRadialGradient(
        mouse.x, mouse.y, 0, 
        mouse.x, mouse.y, radialGlow
      );

      const glowColor = isLightMode
        ? 'rgba(201, 125, 78, 0.06)'
        : 'rgba(201, 125, 78, 0.045)';

      gradient.addColorStop(0, glowColor);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, radialGlow, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  // Initial draw trigger
  requestAnimationFrame(draw);
}
