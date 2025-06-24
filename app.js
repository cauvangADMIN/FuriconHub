// Config
const COLS = 15;           // Number of columns to display
const ROWS = 15;           // Number of rows in viewport
const ICON_SIZE = 200;    // px
const GRID_GAP = 20;      // px

let icons = [];
let gridOffset = { x: 0, y: 0 };
let dragging = false, dragStart = null, dragOffset = null;
let grid, viewport;
let totalRows = 1;

// Load icons from JSON and render initial grid
window.onload = async function() {
  try {
    const response = await fetch('assets/images/manifest.json');
    const data = await response.json();
    
    // Map the data to the format we need
    icons = data.map(item => ({
      src: item.img,
      name: item.caption
    }));
    
    totalRows = Math.ceil(icons.length / COLS);
    grid = document.getElementById('icon-grid');
    viewport = document.getElementById('icon-grid-viewport');
    
    // Calculate the total width including gaps
    const totalWidth = (COLS * ICON_SIZE) + ((COLS - 1) * GRID_GAP);
    const totalHeight = (totalRows * ICON_SIZE) + ((totalRows - 1) * GRID_GAP);
    
    grid.style.gridTemplateColumns = `repeat(${COLS}, ${ICON_SIZE}px)`;
    grid.style.gridTemplateRows = `repeat(${totalRows}, ${ICON_SIZE}px)`;
    grid.style.gridGap = `${GRID_GAP}px`;
    grid.style.width = totalWidth + 'px';
    grid.style.height = totalHeight + 'px';
    
    renderGrid();
    setupDrag();
    
    // Center the grid initially
    centerGrid();
  } catch (error) {
    console.error('Error loading icons:', error);
  }
};

function centerGrid() {
  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  const gridWidth = grid.clientWidth;
  
  // Center horizontally
  const centerX = (viewportWidth - gridWidth) / 2;
  gridOffset.x = Math.max(centerX, 0);
  
  // Apply the centered position
  grid.style.transform = `translate(${gridOffset.x}px,${gridOffset.y}px)`;
}

// Add this at the top with other variables
let visibleIconIndices = new Set(); // Track which icons are currently visible

function renderGrid() {
  // Calculate which tiles should be visible in the viewport
  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  
  // Calculate the visible area in grid coordinates
  const xStart = Math.max(0, Math.floor(-gridOffset.x / (ICON_SIZE + GRID_GAP)));
  const yStart = Math.max(0, Math.floor(-gridOffset.y / (ICON_SIZE + GRID_GAP)));
  
  // Calculate how many columns and rows can fit in the viewport
  const visibleCols = Math.ceil(viewportWidth / (ICON_SIZE + GRID_GAP)) + 1;
  const visibleRows = Math.ceil(viewportHeight / (ICON_SIZE + GRID_GAP)) + 1;
  
  // Calculate end indices with buffer for all directions
  const xEnd = Math.min(COLS, xStart + visibleCols + 1);
  const yEnd = Math.min(totalRows, yStart + visibleRows + 1);

  // Track which icons should be visible now
  const newVisibleIndices = new Set();
  
  // Determine which icons should be visible
  for(let r = yStart; r < yEnd; r++) {
    for(let c = xStart; c < xEnd; c++) {
      const i = r * COLS + c;
      if (icons[i]) {
        newVisibleIndices.add(i);
      }
    }
  }
  
  // Find icons to add (weren't visible before but should be now)
  const iconsToAdd = [...newVisibleIndices].filter(i => !visibleIconIndices.has(i));
  
  // Find icons to remove (were visible before but shouldn't be now)
  const iconsToRemove = [...visibleIconIndices].filter(i => !newVisibleIndices.has(i));
  
  // Add new icons with pop-in animation
  iconsToAdd.forEach(i => {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    
    let tile = document.createElement('div');
    tile.className = 'icon-tile';
    tile.dataset.index = i;
    tile.style.gridRow = r + 1;
    tile.style.gridColumn = c + 1;
    
    // Create image element
    let img = document.createElement('img');
    img.src = icons[i].src;
    img.alt = icons[i].name;
    img.draggable = false;
    tile.appendChild(img);
    
    // Add caption
    let caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = icons[i].name;
    tile.appendChild(caption);
    
    // Add pop-in animation class
    tile.classList.add('pop-in');
    
    grid.appendChild(tile);
  });
  
  // Remove icons that are no longer visible with pop-out animation
  iconsToRemove.forEach(i => {
    const tile = grid.querySelector(`.icon-tile[data-index="${i}"]`);
    if (tile) {
      // Add pop-out animation class
      tile.classList.add('pop-out');
      
      // Remove after animation completes
      setTimeout(() => {
        if (tile.parentNode === grid) {
          grid.removeChild(tile);
        }
      }, 300); // Match this to your animation duration
    }
  });
  
  // Update our tracking of visible icons
  visibleIconIndices = newVisibleIndices;
  
  // Update transform
  updateGridPosition();
}

// New function to update grid position without re-rendering
function updateGridPosition() {
  grid.style.transform = `translate(${gridOffset.x}px,${gridOffset.y}px)`;
}

// Add these variables at the top with other variables
let velocity = { x: 0, y: 0 };
let lastDragPosition = null;
let animationFrame = null;
let lastTimestamp = null;

// Drag Events
function setupDrag() {
  viewport.addEventListener('mousedown', (e) => {
    // Stop any ongoing momentum scrolling
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    
    dragging = true;
    grid.classList.add('dragging'); // Add dragging class
    dragStart = { x: e.clientX, y: e.clientY };
    lastDragPosition = { ...dragStart };
    dragOffset = { ...gridOffset };
    velocity = { x: 0, y: 0 };
    lastTimestamp = performance.now();
    document.body.style.cursor = 'grabbing';
  });
  
  // In the mousemove event listener
  viewport.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTimestamp;
    
    if (deltaTime > 0) {  // Avoid division by zero
      // Calculate velocity (pixels per millisecond)
      velocity.x = (e.clientX - lastDragPosition.x) / deltaTime;
      velocity.y = (e.clientY - lastDragPosition.y) / deltaTime;
    }
    
    lastDragPosition = { x: e.clientX, y: e.clientY };
    lastTimestamp = currentTime;
    
    let nx = dragOffset.x + (e.clientX - dragStart.x);
    let ny = dragOffset.y + (e.clientY - dragStart.y);
    
    // Calculate grid dimensions including gaps
    const gridWidth = (COLS * ICON_SIZE) + ((COLS - 1) * GRID_GAP);
    const gridHeight = (totalRows * ICON_SIZE) + ((totalRows - 1) * GRID_GAP);
    
    // Limit dragging to keep grid visible
    nx = Math.max(Math.min(nx, window.innerWidth - 100), -(gridWidth - 100));
    ny = Math.max(Math.min(ny, window.innerHeight - 100), -(gridHeight - 100));
    
    gridOffset = { x: nx, y: ny };
    updateGridPosition(); // Only update position
    
    // Check if we need to update visible icons
    // Do this less frequently to avoid performance issues
    if (Math.abs(nx - dragOffset.x) > ICON_SIZE/2 || Math.abs(ny - dragOffset.y) > ICON_SIZE/2) {
      renderGrid(); // This will now only add/remove icons as needed
    }
  });
  
  viewport.addEventListener('mouseup', (e) => {
    if (dragging) {
      dragging = false;
      grid.classList.remove('dragging'); // Remove dragging class
      document.body.style.cursor = '';
      
      // Start momentum scrolling if there's velocity
      if (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1) {
        startMomentumScroll();
      }
    }
  });
  
  viewport.addEventListener('mouseleave', (e) => {
    if (dragging) {
      dragging = false;
      document.body.style.cursor = '';
      
      // Start momentum scrolling if there's velocity
      if (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1) {
        startMomentumScroll();
      }
    }
  });
  
  // Touch (mobile)
  viewport.addEventListener('touchstart', (e) => {
    // Stop any ongoing momentum scrolling
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    
    dragging = true;
    let t = e.touches[0];
    dragStart = { x: t.clientX, y: t.clientY };
    lastDragPosition = { ...dragStart };
    dragOffset = { ...gridOffset };
    velocity = { x: 0, y: 0 };
    lastTimestamp = performance.now();
  });
  
  viewport.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    
    // Add at the top with other variables
    let lastRenderTime = 0;
    const RENDER_THROTTLE = 100; // ms between renders during drag
    
    // Then in the mousemove and touchmove event listeners
    const currentTime = performance.now();
    if (currentTime - lastRenderTime > RENDER_THROTTLE) {
      renderGrid();
      lastRenderTime = currentTime;
    }
    let t = e.touches[0];
    
    if (deltaTime > 0) {  // Avoid division by zero
      // Calculate velocity (pixels per millisecond)
      velocity.x = (t.clientX - lastDragPosition.x) / deltaTime;
      velocity.y = (t.clientY - lastDragPosition.y) / deltaTime;
    }
    
    lastDragPosition = { x: t.clientX, y: t.clientY };
    lastTimestamp = currentTime;
    
    let nx = dragOffset.x + (t.clientX - dragStart.x);
    let ny = dragOffset.y + (t.clientY - dragStart.y);
    
    // Calculate grid dimensions including gaps
    const gridWidth = (COLS * ICON_SIZE) + ((COLS - 1) * GRID_GAP);
    const gridHeight = (totalRows * ICON_SIZE) + ((totalRows - 1) * GRID_GAP);
    
    // Limit dragging to prevent white space
    // Right edge constraint
    const minX = Math.min(0, viewportWidth - gridWidth);
    // Left edge constraint
    const maxX = 0;
    // Bottom edge constraint
    const minY = Math.min(0, viewportHeight - gridHeight);
    // Top edge constraint
    const maxY = 0;
    
    // Apply constraints
    nx = Math.max(minX, Math.min(maxX, nx));
    ny = Math.max(minY, Math.min(maxY, ny));
    
    gridOffset = { x: nx, y: ny };
    grid.style.transform = `translate(${gridOffset.x}px,${gridOffset.y}px)`;
    
    // Prevent default to avoid page scrolling
    e.preventDefault();
  }, { passive: false });
  
  viewport.addEventListener('touchend', (e) => {
    if (dragging) {
      dragging = false;
      
      // Start momentum scrolling if there's velocity
      if (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1) {
        startMomentumScroll();
      }
    }
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    centerGrid();
    renderGrid(); // Full render on resize
  });
}

// Add this new function for momentum scrolling
function startMomentumScroll() {
  const friction = 0.95; // Adjust for more or less friction
  const minVelocity = 0.01; // Minimum velocity to continue momentum
  
  function momentumLoop() {
    // Apply friction to slow down
    velocity.x *= friction;
    velocity.y *= friction;
    
    // Update position based on velocity
    gridOffset.x += velocity.x * 16; // Assuming 60fps (16ms)
    gridOffset.y += velocity.y * 16;
    
    // Calculate grid dimensions including gaps
    const gridWidth = (COLS * ICON_SIZE) + ((COLS - 1) * GRID_GAP);
    const gridHeight = (totalRows * ICON_SIZE) + ((totalRows - 1) * GRID_GAP);
    
    // Check boundaries and bounce if needed
    if (gridOffset.x > window.innerWidth - 100) {
      gridOffset.x = window.innerWidth - 100;
      velocity.x = -velocity.x * 0.5; // Bounce with reduced velocity
    } else if (gridOffset.x < -(gridWidth - 100)) {
      gridOffset.x = -(gridWidth - 100);
      velocity.x = -velocity.x * 0.5; // Bounce with reduced velocity
    }
    
    if (gridOffset.y > window.innerHeight - 100) {
      gridOffset.y = window.innerHeight - 100;
      velocity.y = -velocity.y * 0.5; // Bounce with reduced velocity
    } else if (gridOffset.y < -(gridHeight - 100)) {
      gridOffset.y = -(gridHeight - 100);
      velocity.y = -velocity.y * 0.5; // Bounce with reduced velocity
    }
    
    // Update grid position
    updateGridPosition();
    
    // Check if we should continue the animation
    if (Math.abs(velocity.x) > minVelocity || Math.abs(velocity.y) > minVelocity) {
      animationFrame = requestAnimationFrame(momentumLoop);
    } else {
      // If we've slowed down enough, do a final render to ensure all visible tiles are shown
      renderGrid();
      animationFrame = null;
    }
  }
  
  // Start the momentum loop
  animationFrame = requestAnimationFrame(momentumLoop);
}
