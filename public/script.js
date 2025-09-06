 document.getElementById("hostelSelect").addEventListener("change", async function () {
    const hostelId = this.value;
    const floorSelect = document.getElementById("floorSelect");
    floorSelect.innerHTML = "<option>Loading...</option>";

    try {
      const res = await fetch(`/floors/${hostelId}`);
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

  // ✅ Auto-load floors for user’s default hostel (edit mode)
  window.addEventListener("DOMContentLoaded", () => {
    const hostelSelect = document.getElementById("hostelSelect");
    if (hostelSelect.value) {
      hostelSelect.dispatchEvent(new Event("change"));
    }
  });