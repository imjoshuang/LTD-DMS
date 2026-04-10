// script.js
const expenseFields = [
  { qty: "airQty", unit: "airUnit", amt: "airAmt" },
  { qty: "bagQty", unit: "bagUnit", amt: "bagAmt" },
  { qty: "hotelQty", unit: "hotelUnit", amt: "hotelAmt" },
  { qty: "mealLocalQty", unit: "mealLocalUnit", amt: "mealLocalAmt" },
  { qty: "carQty", unit: "carUnit", amt: "carAmt" },
  { qty: "roroQty", unit: "roroUnit", amt: "roroAmt" },
  { qty: "fuelQty", unit: "fuelUnit", amt: "fuelAmt" },
  { qty: "taxiQty", unit: "taxiUnit", amt: "taxiAmt" },
  { qty: "passQty", unit: "passUnit", amt: "passAmt" },
  { qty: "visaQty", unit: "visaUnit", amt: "visaAmt" },
  { qty: "travTaxQty", unit: "travTaxUnit", amt: "travTaxAmt" },
  { qty: "termQty", unit: "termUnit", amt: "termAmt" },
  { qty: "laundryQty", unit: "laundryUnit", amt: "laundryAmt" },
  { qty: "repQty", unit: "repUnit", amt: "repAmt" },
  { qty: "meetCostQty", unit: "meetCostUnit", amt: "meetCostAmt" },
  { qty: "commQty", unit: "commUnit", amt: "commAmt" },
  { qty: "contQty", unit: "contUnit", amt: "contAmt" },
  { qty: "oth1Qty", unit: "oth1Unit", amt: "oth1Amt" },
  { qty: "oth2Qty", unit: "oth2Unit", amt: "oth2Amt" },
];

function fmt(n) {
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function val(id) {
  return parseFloat(document.getElementById(id)?.value) || 0;
}

function recalc() {
  let total = 0;
  expenseFields.forEach((f) => {
    let amt = val(f.qty) * val(f.unit);
    document.getElementById(f.amt).value = amt || "";
    total += amt;
  });

  document.getElementById("totalCA").value = total || "";
  document.getElementById("thisRequest").textContent = fmt(total);

  let budget = val("budgetMonth");
  let prev = val("prevApprovals");
  let available = budget - prev;
  document.getElementById("availBalance").textContent = fmt(available);
  document.getElementById("budgetBalance").textContent = fmt(available - total);

  // Unliquidated
  let ulTotal = 0;
  document.querySelectorAll(".ulAmt").forEach((el) => {
    ulTotal += parseFloat(el.value) || 0;
  });
  document.getElementById("totalUL").textContent = fmt(ulTotal);

  // AFD
  let afdTotal = 0;
  for (let i = 1; i <= 3; i++) {
    let q = parseFloat(document.getElementById(`afd${i}Qty`)?.value) || 0;
    let u = parseFloat(document.getElementById(`afd${i}Unit`)?.value) || 0;
    let a = q * u;
    document.getElementById(`afd${i}Amt`).value = a || "";
    afdTotal += a;
  }
  document.getElementById("totalAFD").textContent = fmt(afdTotal);
}

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto'; // Reset height para makuha ang tamang scrollHeight
  el.style.height = el.scrollHeight + 'px'; // I-set ang height base sa content
}

window.initAutoResize = function(el) {
  el.addEventListener('input', () => autoResizeTextarea(el));
  autoResizeTextarea(el); // Initial call
};

function attachEvents() {
  expenseFields.forEach((f) => {
    document.getElementById(f.qty)?.addEventListener("input", recalc);
    document.getElementById(f.unit)?.addEventListener("input", recalc);
  });
  ["budgetMonth", "prevApprovals"].forEach((id) =>
    document.getElementById(id)?.addEventListener("input", recalc)
  );
  document.querySelectorAll(".ulAmt").forEach((el) =>
    el.addEventListener("input", recalc)
  );
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`afd${i}Qty`)?.addEventListener("input", recalc);
    document.getElementById(`afd${i}Unit`)?.addEventListener("input", recalc);
  }
  
  // I-apply sa lahat ng existing textareas
  document.querySelectorAll('textarea').forEach(window.initAutoResize);
}

function initUserInfo() {
  const userName = sessionStorage.getItem('userName');
  const userDept = sessionStorage.getItem('userDept');
  // const userRole = sessionStorage.getItem('userRole'); // Maaaring gamitin kung kailangan ang designation

  if (userName) {
    // I-update ang Employee Name sa taas
    const empNameInput = document.getElementById('empName');
    if (empNameInput) empNameInput.value = userName;

    // I-update ang Signature Name sa baba
    const reqNameDiv = document.getElementById('requestedByName');
    if (reqNameDiv) reqNameDiv.textContent = userName.toUpperCase();
  }

  if (userDept) {
    const deptInput = document.getElementById('dept');
    if (deptInput) deptInput.value = userDept;
  }
}

window.showConfirm = function(title, message) {
  return new Promise((resolve) => {
      const confirmModal = document.createElement('div');
      confirmModal.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300';
      confirmModal.innerHTML = `
          <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full transform transition-all scale-95 opacity-0" id="confirmContent">
              <div class="p-6 text-center">
                  <div class="w-16 h-16 bg-maroon-ltd/10 text-maroon-ltd rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  </div>
                  <h3 class="text-lg font-bold text-maroon-ltd tracking-tight mb-2 uppercase font-oswald">${title}</h3>
                  <p class="text-gray-500 text-sm leading-relaxed mb-6">${message}</p>
                  <div class="flex gap-3">
                      <button id="cancelBtn" class="flex-1 px-4 py-3 text-xs font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border border-gray-100 rounded-xl uppercase tracking-widest">Cancel</button>
                      <button id="proceedBtn" class="flex-1 px-4 py-3 text-xs font-bold bg-maroon-ltd text-white hover:bg-black transition-colors rounded-xl uppercase tracking-widest shadow-lg shadow-maroon-ltd/20">Confirm Action</button>
                  </div>
              </div>
          </div>
      `;
      document.body.appendChild(confirmModal);

      requestAnimationFrame(() => {
          const content = document.getElementById('confirmContent');
          if (content) content.classList.remove('scale-95', 'opacity-0');
      });

      const close = (result) => {
          const content = document.getElementById('confirmContent');
          if (content) content.classList.add('scale-95', 'opacity-0');
          confirmModal.classList.add('opacity-0');
          setTimeout(() => confirmModal.remove(), 300);
          resolve(result);
      };

      document.getElementById('cancelBtn').onclick = () => close(false);
      document.getElementById('proceedBtn').onclick = () => close(true);
  });
};

async function resetForm() {
  const confirmed = await window.showConfirm('Reset Form', 'Are you sure you want to reset all fields? This action cannot be undone.');
  if (!confirmed) return;
  document
    .querySelectorAll(
      'input:not([type="radio"]):not([type="checkbox"]), textarea, select'
    )
    .forEach((el) => {
      if (!el.hasAttribute("readonly")) el.value = "";
    });
  document
    .querySelectorAll('input[type="checkbox"], input[type="radio"]')
    .forEach((el) => (el.checked = false));
  // I-reset ang height ng textareas pagkatapos i-clear
  setTimeout(() => document.querySelectorAll('textarea').forEach(autoResizeTextarea), 10);
  // Restore defaults
  const userName = sessionStorage.getItem('userName') || "Hanzel Recuelo | Floter Foronda | Chris Tinson | Manolito Bautista";
  const userDept = sessionStorage.getItem('userDept') || "TSSO | PMO";

  document.getElementById("btaDate").value = "2026-02-13";
  document.getElementById("empName").value = userName;
  document.getElementById("designation").value = "System Support Engineer";
  document.getElementById("dept").value = userDept;
  document.getElementById("projCode").value = "PUB0003-01 & 02";
  document.querySelector('input[name="travelType"]').checked = true;

  const reqNameDiv = document.getElementById('requestedByName');
  if (reqNameDiv) reqNameDiv.textContent = userName.toUpperCase();

  recalc();
}

window.addEventListener("load", () => {
  initUserInfo();
  attachEvents();
  recalc();
});