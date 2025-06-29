// Config
const COLS = 15;           // Number of columns to display
const ROWS = 15;           // Number of rows in viewport
const ICON_SIZE = 200;    // px
const GRID_GAP = 20;      // px

let icons = [];           // Metadata for all icons
let loadedIcons = {};     // Cache for loaded icons
let gridOffset = { x: 0, y: 0 };
let dragging = false, dragStart = null, dragOffset = null;
let grid, viewport;
let totalRows = 1;
let visibleIconIndices = new Set(); // Track which icons are currently visible

// Lightbox elements
let lightbox, lightboxImg, lightboxCaption, closeBtn;
let isDraggingGrid = false; // Flag to track if we're dragging the grid

// Variables for drag momentum
let velocity = { x: 0, y: 0 };
let lastDragPosition = null;
let animationFrame = null;
let lastTimestamp = null;
let lastRenderTime = 0;
const RENDER_THROTTLE = 100; // ms between renders during drag

// Setup lightbox functionality
function setupLightbox() {
  // Close lightbox when clicking the close button
  closeBtn.addEventListener('click', () => {
    lightbox.classList.remove('active');
  });
  
  // Close lightbox when clicking outside the content
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      lightbox.classList.remove('active');
    }
  });
  
  // Close lightbox with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      lightbox.classList.remove('active');
    }
  });
  
  // Add copy functionality to the copy button
  const copyBtn = document.querySelector('.copy-btn');
  copyBtn.addEventListener('click', async () => {
    try {
      // Get the current image from the lightbox
      const img = document.getElementById('lightbox-img');
      
      // Create a canvas to draw the image (needed for clipboard API)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Wait for the image to load completely
      await new Promise((resolve) => {
        if (img.complete) {
          resolve();
        } else {
          img.onload = resolve;
        }
      });
      
      // Set canvas dimensions to match the image
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      // Draw the image onto the canvas
      ctx.drawImage(img, 0, 0);
      
      // Convert the canvas to a blob
      canvas.toBlob(async (blob) => {
        try {
          // Create a ClipboardItem with the blob
          const item = new ClipboardItem({ 'image/png': blob });
          
          // Write to clipboard
          await navigator.clipboard.write([item]);
          
          // Show success message
          alert('Image copied to clipboard!');
        } catch (error) {
          console.error('Error copying to clipboard:', error);
          alert('Failed to copy image. ' + error.message);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error preparing image for clipboard:', error);
      alert('Failed to prepare image for copying. ' + error.message);
    }
  });
}

// Load icons metadata from JSON and setup initial grid
window.onload = async function() {
  try {
    const response = await fetch('assets/images/manifest.json');
    const data = await response.json();
    
    // Just store metadata without loading all images
    icons = data.map(item => ({
      originalSrc: item.img,
      name: item.caption,
      loaded: false
    }));
    
    totalRows = Math.ceil(icons.length / COLS);
    grid = document.getElementById('icon-grid');
    viewport = document.getElementById('icon-grid-viewport');
    
    // Initialize lightbox elements
    lightbox = document.getElementById('lightbox');
    lightboxImg = document.getElementById('lightbox-img');
    lightboxCaption = document.querySelector('.lightbox-caption');
    closeBtn = document.querySelector('.close-btn');
    
    // Setup lightbox events
    setupLightbox();
    
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

// Load and process an icon only when needed
async function loadIcon(index) {
  // If already loaded, return from cache
  if (loadedIcons[index]) {
    return loadedIcons[index];
  }
  
  const icon = icons[index];
  if (!icon) return null;
  
  try {
    // Cache the result without watermark
    loadedIcons[index] = {
      src: icon.originalSrc,
      originalSrc: icon.originalSrc,
      name: icon.name
    };
    
    return loadedIcons[index];
  } catch (error) {
    console.error(`Error loading icon ${index}:`, error);
    // Return original image if loading fails
    loadedIcons[index] = {
      src: icon.originalSrc,
      originalSrc: icon.originalSrc,
      name: icon.name
    };
    return loadedIcons[index];
  }
}

// Show lightbox with the selected image
async function showLightbox(iconIndex) {
  // Show loading state
  lightboxImg.src = '';
  lightboxCaption.textContent = 'Loading...';
  lightbox.classList.add('active');
  
  // Load the icon if not already loaded
  const icon = await loadIcon(iconIndex);
  if (!icon) return;
  
  lightboxImg.src = icon.src;
  lightboxImg.alt = icon.name;
  lightboxCaption.textContent = icon.name;
}

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
    
    // Create image placeholder
    let img = document.createElement('img');
    img.alt = icons[i].name;
    img.draggable = false;
    
    // Add loading indicator
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+';
    
    tile.appendChild(img);
    
    // Add caption
    let caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = icons[i].name;
    tile.appendChild(caption);
    
    // Add pop-in animation class
    tile.classList.add('pop-in');
    
    // Add click event to show lightbox
    tile.addEventListener('click', (e) => {
      // Only show lightbox if we're not dragging the grid
      if (!isDraggingGrid) {
        showLightbox(i);
      }
    });
    
    grid.appendChild(tile);
    
    // Load the actual image
    loadIcon(i).then(loadedIcon => {
      if (loadedIcon && tile.parentNode === grid) {
        img.src = loadedIcon.src;
      }
    }).catch(err => {
      console.error(`Error loading icon ${i}:`, err);
    });
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

// Drag Events
function setupDrag() {
  viewport.addEventListener('mousedown', (e) => {
    // Stop any ongoing momentum scrolling
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    
    dragging = true;
    isDraggingGrid = false; // Reset the dragging flag
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
    
    // Set the flag to true if we've moved more than a few pixels
    if (Math.abs(e.clientX - dragStart.x) > 5 || Math.abs(e.clientY - dragStart.y) > 5) {
      isDraggingGrid = true;
    }
    
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
    isDraggingGrid = false; // Reset the dragging flag for touch events
    let t = e.touches[0];
    dragStart = { x: t.clientX, y: t.clientY };
    lastDragPosition = { ...dragStart };
    dragOffset = { ...gridOffset };
    velocity = { x: 0, y: 0 };
    lastTimestamp = performance.now();
  });
  
  viewport.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    
    // Set the flag to true if we've moved more than a few pixels
    let t = e.touches[0];
    if (Math.abs(t.clientX - dragStart.x) > 5 || Math.abs(t.clientY - dragStart.y) > 5) {
      isDraggingGrid = true;
    }
    
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTimestamp;
    
    // Then in the mousemove and touchmove event listeners
    if (currentTime - lastRenderTime > RENDER_THROTTLE) {
      renderGrid();
      lastRenderTime = currentTime;
    }
    
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
    
    // Get current viewport dimensions
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    
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
    updateGridPosition(); // Use the same update function as mouse events
    
    // Prevent default to avoid page scrolling
    e.preventDefault();
  }, { passive: false });
  
  viewport.addEventListener('touchend', (e) => {
    if (dragging) {
      dragging = false;
      grid.classList.remove('dragging'); // Remove dragging class like in mouseup
      
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

// Ad Banner Management
const desktopAdScripts = [
  {
    atOptions: {
      'key': 'c0554a7b1b255283aa18326eb3440b12',
      'format': 'iframe',
      'height': 90,
      'width': 728,
      'params': {}
    },
    src: '//snailthreatenedinvited.com/c0554a7b1b255283aa18326eb3440b12/invoke.js'
  },
  {
    atOptions: {
      'key': '19882b1c51dda4b9e25bfbac0d2842b9',
      'format': 'iframe',
      'height': 90,
      'width': 728,
      'params': {}
    },
    src: '//snailthreatenedinvited.com/19882b1c51dda4b9e25bfbac0d2842b9/invoke.js'
  },
  {
    atOptions: {
      'key': '8df9ddedc9378c3551931bb97512728b',
      'format': 'iframe',
      'height': 90,
      'width': 728,
      'params': {}
    },
    src: '//snailthreatenedinvited.com/8df9ddedc9378c3551931bb97512728b/invoke.js'
  },
  {
    atOptions: {
      'key': '45b3f26c1dcbc1b3eb20d40b1059f55c',
      'format': 'iframe',
      'height': 90,
      'width': 728,
      'params': {}
    },
    src: '//snailthreatenedinvited.com/45b3f26c1dcbc1b3eb20d40b1059f55c/invoke.js'
  },
  {
    atOptions: {
      'key': '66b5f133ececafa99d08648df00df691',
      'format': 'iframe',
      'height': 90,
      'width': 728,
      'params': {}
    },
    src: '//snailthreatenedinvited.com/66b5f133ececafa99d08648df00df691/invoke.js'
  }
];

const mobileAdScripts = [
  {
    atOptions: {
      'key': '3d5952392e7aa4283bb507a471443b66',
      'format': 'iframe',
      'height': 60,
      'width': 468,
      'params': {}
    },
    src: '//snailthreatenedinvited.com/3d5952392e7aa4283bb507a471443b66/invoke.js'
  },
  {
    atOptions: {
      'key': '0e30e11022ca384f24b66435d8805b45',
      'format': 'iframe',
      'height': 60,
      'width': 468,
      'params': {}
    },
    src: '//snailthreatenedinvited.com/0e30e11022ca384f24b66435d8805b45/invoke.js'
  },
  {
    atOptions: {
      'key': '5ba06a022cf6fe415b79ac6d25d27981',
      'format': 'iframe',
      'height': 60,
      'width': 468,
      'params': {}
    },
    src: '//snailthreatenedinvited.com/5ba06a022cf6fe415b79ac6d25d27981/invoke.js'
  },
  {
    atOptions: {
      'key': '179263f701feef7d655b640f88937afe',
      'format': 'iframe',
      'height': 60,
      'width': 468,
      'params': {}
    },
    src: '//snailthreatenedinvited.com/179263f701feef7d655b640f88937afe/invoke.js'
  },
  {
    atOptions: {
      'key': '8ff4a7c8c277133017ddccbea54360f9',
      'format': 'iframe',
      'height': 60,
      'width': 468,
      'params': {}
    },
    src: '//snailthreatenedinvited.com/8ff4a7c8c277133017ddccbea54360f9/invoke.js'
  }
];
let currentAdIndex = 0;
let adRotationInterval;

// Function to check if device is mobile
function isMobileDevice() {
  return window.innerWidth <= 768;
}

// Function to load a random ad script
function loadRandomAdScript() {
  const adContainer = document.getElementById('ad-container');
  if (!adContainer) return;
  
  // Clear previous ad content
  adContainer.innerHTML = '';
  
  // Select appropriate ad scripts based on device type
  const adScripts = isMobileDevice() ? mobileAdScripts : desktopAdScripts;
  
  // Get current ad script
  const adScript = adScripts[currentAdIndex];
  
  // Create a container for this specific ad
  const adElement = document.createElement('div');
  adElement.className = 'ad-element';
  adContainer.appendChild(adElement);
  
  // Set global atOptions variable required by the ad script
  window.atOptions = adScript.atOptions;
  
  // Create and append the script element
  const scriptElement = document.createElement('script');
  scriptElement.type = 'text/javascript';
  scriptElement.src = adScript.src;
  adElement.appendChild(scriptElement);
  
  // Update index for next rotation
  currentAdIndex = (currentAdIndex + 1) % adScripts.length;
}

// Function to start ad rotation
function startAdRotation() {
  // Load initial ad
  loadRandomAdScript();
  
  // Set up rotation interval (15 seconds)
  adRotationInterval = setInterval(loadRandomAdScript, 15000);
}

// Initialize ad system when window loads
window.addEventListener('load', () => {
  startAdRotation();
  
  // Reload appropriate ad when window is resized (switching between mobile/desktop)
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      loadRandomAdScript();
    }, 300);
  });
});
