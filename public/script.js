// Dashboard - hostel floor selection
if (document.getElementById("hostelSelect")) {
  document.getElementById("hostelSelect").addEventListener("change", async function () {
    const hostelId = this.value;
    const floorSelect = document.getElementById("floorSelect");
    floorSelect.innerHTML = "<option>Loading...</option>";

    try {
      const res = await fetch(/floors/);
      const floors = await res.json();

      if (floors.length > 0) {
        floorSelect.innerHTML = "";
        floors.forEach(floor => {
          const option = document.createElement("option");
          option.value = floor.id;
          option.textContent = floor.floor;
          floorSelect.appendChild(option);
        });
      } else {
        floorSelect.innerHTML = "<option disabled>No floors available</option>";
      }
    } catch (err) {
      floorSelect.innerHTML = "<option disabled>Error loading floors</option>";
    }
  });

  // Auto-load floors for user's default hostel (edit mode)
  window.addEventListener("DOMContentLoaded", () => {
    const hostelSelect = document.getElementById("hostelSelect");
    if (hostelSelect.value) {
      hostelSelect.dispatchEvent(new Event("change"));
    }
  });
}
// Home page - Search and Filter functionality
if (document.getElementById('searchInput')) {
  const searchInput = document.getElementById('searchInput');
  const clearFiltersBtn = document.getElementById('clearFilters');
  const hostelList = document.getElementById('hostelList');
  const resultsCount = document.getElementById('resultsCount');

  // Get all filter chips
  const filterChips = document.querySelectorAll('.filter-chip');
  
  // Active filters storage
  const activeFilters = {
    gender: [],
    hostelType: [],
    bedType: [],
    dhobi: [],
    bedAvailability: []
  };

  // Toggle chip selection
  filterChips.forEach(chip => {
    chip.addEventListener('click', function() {
      this.classList.toggle('active');
      const filterType = this.dataset.filter;
      const value = this.dataset.value;
      
      if (this.classList.contains('active')) {
        if (!activeFilters[filterType].includes(value)) {
          activeFilters[filterType].push(value);
        }
      } else {
        activeFilters[filterType] = activeFilters[filterType].filter(v => v !== value);
      }
      
      filterHostels();
    });
  });

  function filterHostels() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedGenders = activeFilters.gender;
    const selectedHostelTypes = activeFilters.hostelType;
    const selectedBedTypes = activeFilters.bedType;
    const selectedDhobi = activeFilters.dhobi;
    const selectedBedAvailability = activeFilters.bedAvailability;

    const cards = hostelList.querySelectorAll('.card-link .card');
    let visibleCount = 0;

    cards.forEach(card => {
      const hostelName = card.querySelector('h3')?.textContent.toLowerCase() || '';
      const genderChip = card.querySelector('.chip-blue, .chip-ladies')?.textContent.trim() || '';
      const chips = Array.from(card.querySelectorAll('.chip, .chip-no'));
      
      let hostelTypeText = '';
      let bedTypeText = '';
      let dhobiText = '';
      let bedAvailabilityText = '';

      chips.forEach(chip => {
        const text = chip.textContent.trim();
        const dhobiAttr = chip.getAttribute('data-dhobi');
        
        if (dhobiAttr) {
          dhobiText = dhobiAttr;
        } else if (text.includes('AC') || text.includes('NON AC')) {
          hostelTypeText = text;
        } else if (text.includes('BUNKER')) {
          bedTypeText = text;
        } else if (text.includes('BED')) {
          bedAvailabilityText = text;
        }
      });

      // Apply filters (if nothing is selected, show all)
      const matchesSearch = hostelName.includes(searchTerm);
      const matchesGender = selectedGenders.length === 0 || selectedGenders.includes(genderChip);
      const matchesHostelType = selectedHostelTypes.length === 0 || selectedHostelTypes.includes(hostelTypeText);
      const matchesBedType = selectedBedTypes.length === 0 || selectedBedTypes.includes(bedTypeText);
      const matchesDhobi = selectedDhobi.length === 0 || selectedDhobi.includes(dhobiText);
      const matchesBedAvailability = selectedBedAvailability.length === 0 || selectedBedAvailability.some(bed => bedAvailabilityText.includes(bed));

      const isVisible = matchesSearch && matchesGender && matchesHostelType && 
                       matchesBedType && matchesDhobi && matchesBedAvailability;

      const cardLink = card.closest('.card-link');
      if (cardLink) {
        cardLink.style.display = isVisible ? 'block' : 'none';
      } else {
        card.style.display = isVisible ? 'block' : 'none';
      }
      if (isVisible) visibleCount++;
    });

    // Update results count
    const totalCards = cards.length;
    resultsCount.textContent = `Showing ${visibleCount} of ${totalCards} hostels`;
  }

  // Event listeners
  searchInput.addEventListener('input', filterHostels);

  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterChips.forEach(chip => chip.classList.remove('active'));
    Object.keys(activeFilters).forEach(key => activeFilters[key] = []);
    filterHostels();
  });

  // Initial count
  window.addEventListener('DOMContentLoaded', filterHostels);
}

// Hostel page - Accordion functionality
if (document.querySelector('.accordion-header')) {
  (function(){
    function initAccordion(){
      const headers = document.querySelectorAll('.accordion-header');
      headers.forEach(header => {
        const targetId = header.dataset.target;
        const panel = document.getElementById(targetId);
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', 'false');
        if(panel) panel.setAttribute('aria-hidden', 'true');

        header.addEventListener('click', () => toggle(header, panel));
        header.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(header, panel); }
        });
      });
    }

    function toggle(header, panel){
      const item = header.closest('.accordion-item');
      const willOpen = !item.classList.contains('open');
      item.classList.toggle('open', willOpen);
      header.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if(panel){
        panel.classList.toggle('open', willOpen);
        panel.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
        if(willOpen){
          const imgs = panel.querySelectorAll('img[data-src].lazy-floor');
          imgs.forEach(img => { if(!img.src) img.src = img.dataset.src; });
          const focusable = panel.querySelector('a, button, input, [tabindex]');
          if(focusable) focusable.focus();
        }
      }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAccordion);
    else initAccordion();
  })();
}

// Hostel page - Show room image with SweetAlert2
function showRoomImage(imageUrl) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      imageUrl: imageUrl,
      imageWidth: 600,
      imageHeight: 'auto',
      imageAlt: 'Room Image',
      confirmButtonText: 'Close',
      confirmButtonColor: '#6366f1'
    });
  }
}

// Floor plan page - Success/Error message handling
if (window.location.pathname.includes('/floor/')) {
  document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    const error = urlParams.get('error');
    
    if (message && typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: decodeURIComponent(message),
        confirmButtonColor: '#6366f1'
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (error && typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: decodeURIComponent(error),
        confirmButtonColor: '#ef4444'
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  });
}

// Dashboard - Speed test functionality
if (document.getElementById('rerun-speed')) {
  function runSpeedTestAndUpdate() {
    const downloadDisplay = document.getElementById('download-speed-display');
    const uploadDisplay = document.getElementById('upload-speed-display');
    const statusElement = document.getElementById('speed-status');
    const downloadInput = document.getElementById('download-speed-input');
    const uploadInput = document.getElementById('upload-speed-input');

    statusElement.textContent = 'Running speed test...';
    fetch('/api/speedtest')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            downloadDisplay.textContent = `${data.downloadSpeed} Mbps`;
            uploadDisplay.textContent = `${data.uploadSpeed} Mbps`;
            downloadInput.value = data.downloadSpeed;
            uploadInput.value = data.uploadSpeed;
            statusElement.textContent = 'Speed test complete.';
        })
        .catch(error => {
            console.error('Error fetching speed test results:', error);
            downloadDisplay.textContent = 'Error';
            uploadDisplay.textContent = 'Error';
            statusElement.textContent = 'Could not complete speed test.';
        });
  }

  document.addEventListener('DOMContentLoaded', () => {
      const rerunBtn = document.getElementById('rerun-speed');
      if (rerunBtn) {
        rerunBtn.addEventListener('click', runSpeedTestAndUpdate);
        runSpeedTestAndUpdate();
      }
  });
}

// Navbar - Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const navActionsWrapper = document.getElementById('navActionsWrapper');
  
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', function() {
      navActionsWrapper.classList.toggle('show');
      const icon = this.querySelector('i');
      if (navActionsWrapper.classList.contains('show')) {
        icon.classList.remove('bi-list');
        icon.classList.add('bi-x');
      } else {
        icon.classList.remove('bi-x');
        icon.classList.add('bi-list');
      }
    });
  }
  
  // Close menu when clicking outside
  document.addEventListener('click', function(event) {
    if (navActionsWrapper && mobileMenuToggle) {
      if (!event.target.closest('.nav-shell')) {
        navActionsWrapper.classList.remove('show');
        const icon = mobileMenuToggle.querySelector('i');
        icon.classList.remove('bi-x');
        icon.classList.add('bi-list');
      }
    }
  });
});

// Navbar - Layout display functions
function mhlayout(){
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: "Mens Hostel Layout",
      imageUrl: "/mhlayout.png",
      imageWidth: 800,
      imageHeight: 500,
      imageAlt: "MH Layout",
      confirmButtonColor: '#6366f1',
      width: 'auto',
      customClass: {
        popup: 'responsive-swal'
      }
    });
  }
}

function lhlayout(){
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: "Ladies Hostel Layout",
      imageUrl: "/mhlayout.png",
      imageWidth: 800,
      imageHeight: 500,
      imageAlt: "LH Layout",
      confirmButtonColor: '#6366f1',
      width: 'auto',
      customClass: {
        popup: 'responsive-swal'
      }
    });
  }
}
