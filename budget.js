// budget.js - Finance & Budget Calculation Logic
// Extracted from app.js for better isolation

// --- GLOBAL STATE & SETTINGS ---
let globalPieChart = null;
let dailyPieChart = null;

window.globalFixedCosts = { flights: 4500, car: 1200, accommodation: 0, misc: 0 };

window.itinerarySettings = {
    gas: {
        price: 1.85,          // CAD/L
        consumption: 10,      // L/100km
        tankCapacity: 60,     // L
        refuelThreshold: 450, // km range used before refueling
        dailyLocal: 20        // km daily local driving
    }
};

// --- INITIALIZATION & ESTIMATES ---

// --- INITIALIZATION & ESTIMATES ---

window.populateEstimates = function () {
    // 1. RESTORE FROM LOCAL STORAGE FIRST
    let saved = localStorage.getItem('steph_itinerary_state');
    // FALLBACK: Try old keys if new prefix is missing
    // if (!saved) saved = localStorage.getItem('itinerary_state');
    // if (!saved) saved = localStorage.getItem('itineraryState');

    let savedFixed = localStorage.getItem('crc_fixed_costs');
    // if (!savedFixed) savedFixed = localStorage.getItem('fixed_costs');

    // We assume window.itineraryState is available (managed by app.js data loading)

    // RECOVERY LOGIC: Check if legacy data is "better" than current data
    // If we have legacy data but no current data (or current is "newly initialized"), prefer legacy.
    let legacy = null; // localStorage.getItem('itinerary_state');
    if (legacy && (!saved || saved.length < legacy.length)) {
        console.warn("⚠️ RECOVERY: Found larger/older legacy data. Preferring it over current state.");
        saved = legacy;
    }

    if (saved) {
        try {
            const savedState = JSON.parse(saved);
            Object.keys(savedState).forEach(k => {
                if (window.itineraryState[k]) {
                    const savedDay = savedState[k];
                    const currentDay = window.itineraryState[k];

                    // Restore Expenses (Always safe)
                    if (savedDay.expenses) currentDay.expenses = { ...currentDay.expenses, ...savedDay.expenses };

                    // Restore Item Lists (ACTIVITIES & RESTAURANTS)
                    // If saved state exists, it means user potentially deleted/added items. Trust storage over data.js.
                    if (savedDay.activities && Array.isArray(savedDay.activities)) {
                        currentDay.activities = savedDay.activities;
                    }
                    if (savedDay.restaurants && Array.isArray(savedDay.restaurants)) {
                        currentDay.restaurants = savedDay.restaurants;
                    }
                    if (savedDay.accommodation) {
                        currentDay.accommodation = savedDay.accommodation;
                    }

                    // Restore Locked State
                    if (savedDay.locked) {
                        currentDay.locked = savedDay.locked;
                        if (!currentDay.locked.restaurants) currentDay.locked.restaurants = {};
                    }
                }
            });
            console.log("✅ Data restored from LocalStorage.");
        } catch (e) {
            console.error("Restore failed", e);
        }
    }

    if (savedFixed) {
        try {
            const parsedFixed = JSON.parse(savedFixed);
            window.globalFixedCosts = { ...window.globalFixedCosts, ...parsedFixed };
        } catch (e) {
            console.error("Fixed cost restore failed", e);
        }
    }

    // 1.5 MIGRATION: Convert legacy "locked" object to item properties
    days.forEach(d => {
        const dayState = window.itineraryState[d.d];
        if (dayState && dayState.locked) {
            // Migrate Activities
            if (dayState.locked.activities && dayState.activities) {
                Object.keys(dayState.locked.activities).forEach(idx => {
                    if (dayState.activities[idx]) dayState.activities[idx].locked = true;
                });
                dayState.locked.activities = {};
            }
            // Migrate Restaurants
            if (dayState.locked.restaurants && dayState.restaurants) {
                Object.keys(dayState.locked.restaurants).forEach(idx => {
                    if (dayState.restaurants[idx]) dayState.restaurants[idx].locked = true;
                });
                dayState.locked.restaurants = {};
            }
        }

        // MIGRATION 2: Remove legacy 'accommodation' from expenses (causes double-counting)
        if (dayState && dayState.expenses && 'accommodation' in dayState.expenses) {
            console.log(`🔧 Migration: Removing legacy 'accommodation' expense from ${d.d}`);
            delete dayState.expenses.accommodation;
        }
    });


    // 4. RESTORE SETTINGS FROM LOCAL STORAGE
    const savedSettings = localStorage.getItem('steph_itinerary_settings');
    if (savedSettings) {
        try {
            window.itinerarySettings = JSON.parse(savedSettings);
        } catch (e) {
            console.error("Settings restore failed", e);
        }
    }

    // renderDetailsGrid(); // Removed: handled by app.js and not globally accessible here
    window.updateGlobalBudget();
};


// --- UPDATE & CALCULATION LOGIC ---

window.updateFixedCost = function (key, val) {
    window.globalFixedCosts[key] = parseFloat(val) || 0;
    window.updateGlobalBudget();
};

window.updateFixedCosts = function () {
    const flightsInput = document.getElementById('input-flights');
    const carInput = document.getElementById('input-car');


    if (flightsInput) window.globalFixedCosts.flights = parseFloat(flightsInput.value) || 0;
    if (carInput) window.globalFixedCosts.car = parseFloat(carInput.value) || 0;
    // Insurance removed per user request

    window.updateGlobalBudget();
};

window.resetFixedCosts = function () {
    window.globalFixedCosts = { flights: 0, car: 0, accommodation: 0, misc: 0 };
    document.querySelectorAll('.budget-fix-input').forEach(el => el.value = '');
    const inputs = ['input-flights', 'input-car'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 0;
    });
    window.updateGlobalBudget();
};

window.updateBudget = function (dayId, type, val) {
    if (val === "") {
        window.itineraryState[dayId].expenses[type] = null;
        if (window.itineraryState[dayId].locked) {
            delete window.itineraryState[dayId].locked.expenses[type];
        }
    } else {
        window.itineraryState[dayId].expenses[type] = parseFloat(val) || 0;
        if (!window.itineraryState[dayId].locked) window.itineraryState[dayId].locked = { expenses: {}, activities: {} };
        window.itineraryState[dayId].locked.expenses[type] = true;
    }
    updateTotal(dayId);
};

// Internal helper (or global if needed by app.js)
window.updateTotal = function (dayId) {
    const s = window.itineraryState[dayId];
    const actTotal = s.activities.reduce((acc, a) => acc + (a.price || 0), 0);
    const restTotal = s.restaurants.reduce((acc, r) => acc + (r.price || 0), 0);
    const expTotal = Object.values(s.expenses).reduce((acc, v) => acc + (v || 0), 0);
    const total = actTotal + expTotal + restTotal;
    const el = document.getElementById(`total-${dayId}`);
    if (el) el.textContent = '$' + total.toLocaleString();

    if (window.updateGlobalBudget) window.updateGlobalBudget();
    localStorage.setItem('steph_itinerary_state', JSON.stringify(window.itineraryState));
}
// Alias for backward compatibility if `updateTotal` was not window// --- RE-CALCULATE & UPDATE GLOBAL BUDGET ---
// CALCULATION LOGIC
window.updateGlobalBudget = function (forceSave = false) {
    let totalVariable = 0;
    let allActivities = [];

    // Reset categories
    let catVariable = {
        activities: 0, restaurants: 0,
        food: 0, drinks: 0,
        gas: 0, parking: 0, transport_other: 0,
        shopping: 0,
        tips: 0, night: 0
    };

    Object.values(window.itineraryState).forEach(dayState => {
        // Find city name for this day state.
        const dayId = dayState.dayId || Object.keys(window.itineraryState).find(k => window.itineraryState[k] === dayState);
        const city = days.find(d => String(d.d) === String(dayId))?.loc || 'Unknown';

        // Collect Activities for the Priority Table
        dayState.activities.forEach(a => {
            if (a.name && a.price > 0) {
                allActivities.push({
                    name: a.name,
                    price: a.price,
                    location: city,
                    day: dayId || '?'
                });
            }
        });

        const actTotal = dayState.activities.reduce((acc, a) => acc + (a.price || 0), 0);
        catVariable.activities += actTotal;

        const restTotal = (dayState.restaurants || []).reduce((acc, r) => acc + (r.price || 0), 0);
        catVariable.restaurants += restTotal;

        // Granular Summing
        catVariable.food += (dayState.expenses.food || 0);
        catVariable.drinks += (dayState.expenses.drinks || 0);
        catVariable.gas += (dayState.expenses.gas || 0);
        catVariable.parking += (dayState.expenses.parking || 0);
        catVariable.shopping += (dayState.expenses.goods || 0);
        catVariable.tips += (dayState.expenses.tips || 0);
        catVariable.night += (dayState.expenses.night || 0);

        // Grand Total (Variable portion)
        const expTotal = (dayState.expenses.food || 0) +
            (dayState.expenses.drinks || 0) +
            (dayState.expenses.gas || 0) +
            (dayState.expenses.parking || 0) +
            (dayState.expenses.goods || 0) +
            (dayState.expenses.tips || 0) +
            (dayState.expenses.night || 0);

        totalVariable += (actTotal + restTotal + expTotal);
    });

    const totalFixed = Object.values(window.globalFixedCosts).reduce((acc, v) => acc + v, 0);
    const grandTotal = totalVariable + totalFixed;

    const elVar = document.getElementById('total-variable');
    const elFixed = document.getElementById('total-fixed');
    const elGrandTbl = document.getElementById('grand-total-tbl');

    if (elVar) elVar.textContent = '$' + totalVariable.toLocaleString();
    if (elFixed) elFixed.textContent = '$' + totalFixed.toLocaleString();
    if (elGrandTbl) elGrandTbl.textContent = '$' + grandTotal.toLocaleString();

    // --- GLOBAL CHART CATEGORIES ---

    // 1. Accommodation (Fixed + Daily Nights)
    let totalAccom = window.globalFixedCosts.accommodation + catVariable.night;

    // 2. Transport (Fixed Car + Daily Gas + Parking?) 
    let totalTransportChart = window.globalFixedCosts.car + catVariable.gas + catVariable.parking;
    let totalTransportTable = catVariable.gas + catVariable.parking;

    // 3. Activities
    let totalActivities = catVariable.activities;

    // 5. Grocery (Food)
    let totalGrocery = catVariable.food;

    // 8. Other (Drinks + Tips + Insurance/Misc)
    let totalOther = (window.globalFixedCosts.misc || 0) + catVariable.drinks + catVariable.tips;

    const elAccom = document.getElementById('tbl-accom');
    const elActivities = document.getElementById('tbl-activities');
    const elRestaurants = document.getElementById('tbl-restaurants');
    const elFood = document.getElementById('tbl-food');
    const elTransport = document.getElementById('tbl-transport');
    const elShopping = document.getElementById('tbl-shopping');
    const elOther = document.getElementById('tbl-other');

    if (elAccom) elAccom.textContent = '$' + totalAccom.toLocaleString();
    if (elActivities) elActivities.textContent = '$' + totalActivities.toLocaleString();
    if (elRestaurants) elRestaurants.textContent = '$' + catVariable.restaurants.toLocaleString();
    if (elFood) elFood.textContent = '$' + totalGrocery.toLocaleString();
    if (elTransport) elTransport.textContent = '$' + totalTransportTable.toLocaleString();
    if (elShopping) elShopping.textContent = '$' + catVariable.shopping.toLocaleString();
    if (elOther) elOther.textContent = '$' + totalOther.toLocaleString();

    // Prepare data for renderBudgetVisuals
    const globalBudgetBreakdown = {
        vols: window.globalFixedCosts.flights || 0,
        hebergement: totalAccom,
        transport: totalTransportChart,
        activites: totalActivities,
        epicerie: totalGrocery,
        autres: totalOther
    };

    // Compute Daily Average Breakdown
    const dailyCatTotals = {
        resto: 0,
        goods: 0,
        drinks: 0,
        tips: 0,
        gas: 0,
        parking: 0,
        epicerie: 0
    };

    days.forEach(d => {
        if (window.itineraryState[d.d]) {
            const exp = window.itineraryState[d.d].expenses || {};
            const res = window.itineraryState[d.d].restaurants || [];

            res.forEach(r => dailyCatTotals.resto += (r.price || 0));
            dailyCatTotals.goods += (exp.goods || 0);
            dailyCatTotals.drinks += (exp.drinks || 0);
            dailyCatTotals.tips += (exp.tips || 0);
            dailyCatTotals.gas += (exp.gas || 0);
            dailyCatTotals.parking += (exp.parking || 0);
            dailyCatTotals.epicerie += (exp.food || 0);
        }
    });

    const safeDayCount = days.length || 1;
    const dailyAvgBreakdown = {};
    let dailyAvgTotal = 0;

    Object.keys(dailyCatTotals).forEach(k => {
        const avg = Math.round(dailyCatTotals[k] / safeDayCount);
        dailyAvgBreakdown[k] = avg;
        dailyAvgTotal += avg;
    });

    // RENDER VISUALS
    // RENDER VISUALS
    renderBudgetVisuals(grandTotal, globalBudgetBreakdown, dailyAvgTotal, dailyAvgBreakdown, dailyCatTotals);

    // --- PERSISTENCE ---
    if (window.isAppReady || forceSave) {
        localStorage.setItem('steph_itinerary_state', JSON.stringify(window.itineraryState));
        localStorage.setItem('steph_global_fixed_costs', JSON.stringify(window.globalFixedCosts));
        localStorage.setItem('steph_itinerary_settings', JSON.stringify(window.itinerarySettings));
    }

    // --- DASHBOARD KPIS ---
    const totalDays = 18;
    const totalPax = 5;

    const elKpiTotal = document.getElementById('kpi-grand-total');
    if (elKpiTotal) elKpiTotal.textContent = '$' + grandTotal.toLocaleString();

    const elKpiDay = document.getElementById('kpi-cost-day');
    if (elKpiDay) elKpiDay.textContent = '$' + Math.round(grandTotal / totalDays).toLocaleString();

    const elKpiPerson = document.getElementById('kpi-cost-person');
    if (elKpiPerson) elKpiPerson.textContent = '$' + Math.round(grandTotal / totalPax).toLocaleString();

    // --- PARETO ANALYSIS (TOP SPENDERS) ---
    const spenderBody = document.getElementById('top-spenders-body');
    if (spenderBody) {
        let allExpenses = [];

        // 1. Add Fixed Costs
        if (window.globalFixedCosts.flights > 0) allExpenses.push({ name: 'Vols Internationaux', cat: 'Fixed', loc: 'Global', day: '-', price: window.globalFixedCosts.flights });
        if (window.globalFixedCosts.car > 0) allExpenses.push({ name: 'Location Auto (4x4)', cat: 'Fixed', loc: 'Global', day: '-', price: window.globalFixedCosts.car });

        // 2. Add Activities, Restaurants, Hotels
        Object.values(window.itineraryState).forEach(dayState => {
            const dayId = dayState.dayId || Object.keys(window.itineraryState).find(k => window.itineraryState[k] === dayState);
            if (!dayId) return;

            const city = days.find(d => String(d.d) === String(dayId))?.loc || 'Unknown';

            // Activities (> $100)
            dayState.activities.forEach(a => {
                if (a.name && (a.price > 100)) {
                    allExpenses.push({ name: a.name, cat: 'Activity', loc: city, day: dayId, price: a.price });
                }
            });

            // Restaurants (> $100)
            dayState.restaurants.forEach(r => {
                if (r.name && (r.price > 100)) {
                    allExpenses.push({ name: r.name, cat: 'Restaurant', loc: city, day: dayId, price: r.price });
                }
            });

            // Accommodation (Daily Night Cost)
            if (dayState.expenses.night > 0) {
                allExpenses.push({ name: `Hébergement (${city})`, cat: 'Hotel', loc: city, day: dayId, price: dayState.expenses.night });
            }
        });

        // Sort DESC
        const topSpenders = allExpenses.sort((a, b) => b.price - a.price).slice(0, 10);

        spenderBody.innerHTML = topSpenders.map(item => {
            const pct = ((item.price / grandTotal) * 100).toFixed(1);
            let icon = 'money-bill';
            let col = 'text-stone-400';
            if (item.cat === 'Fixed') { icon = 'plane'; col = 'text-blue-400'; }
            if (item.cat === 'Activity') { icon = 'ticket-alt'; col = 'text-red-400'; }
            if (item.cat === 'Restaurant') { icon = 'utensils'; col = 'text-purple-400'; }
            if (item.cat === 'Hotel') { icon = 'bed'; col = 'text-amber-400'; }

            return `
            <tr class="border-b border-white/5 hover:bg-white/5 transition-colors group">
                <td class="py-3 px-4 font-bold text-white flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-stone-800 flex items-center justify-center ${col}"><i class="fas fa-${icon}"></i></div>
                    ${item.name}
                </td>
                <td class="py-3 px-4 text-stone-500 text-xs uppercase font-bold tracking-wider">${item.cat}</td>
                <td class="py-3 px-4 text-center">
                        <span class="bg-stone-800 text-stone-400 text-[10px] font-black px-2 py-0.5 rounded border border-white/10">${item.day !== '-' ? 'J' + item.day.replace(/\D/g, '') : '-'}</span>
                </td>
                <td class="py-3 px-4 text-right font-black text-cr-gold tracking-tighter text-base">$${item.price.toLocaleString()}</td>
                    <td class="py-3 px-4 text-right text-xs font-mono text-stone-500">${pct}%</td>
            </tr>
        `}).join('');
    }
};

// --- VISUALIZATION FUNCTION ---
function renderBudgetVisuals(total, globalCats, dailyAvgTotal, dailyAvgBreakdown, dailyCatTotals) {
    // COLORS
    // COLORS - More harmonious "Nature Fintech" palette
    const colors = {
        vols: '#334155',         // Slate 700 (Pro)
        hebergement: '#b45309',  // Amber 700 (Warm)
        transport: '#065f46',    // Emerald 800 (Forest)
        activites: '#991b1b',    // Red 800 (Deep Earth)
        epicerie: '#7c2d12',     // Orange 900 (Warmth)
        autres: '#1e293b',       // Slate 800
        resto: '#6d28d9',        // Violet 700
        goods: '#be185d',        // Pink 700
        drinks: '#1d4ed8',       // Blue 700
        tips: '#4d7c0f',         // Lime 700
        gas: '#0f766e',          // Teal 700
        parking: '#475569'       // Slate 600
    };

    const icons = {
        vols: 'fa-plane',
        hebergement: 'fa-bed',
        transport: 'fa-car',
        activites: 'fa-person-hiking',
        epicerie: 'fa-basket-shopping',
        autres: 'fa-ellipsis',
        resto: 'fa-utensils',
        goods: 'fa-suitcase',
        drinks: 'fa-martini-glass-citrus',
        tips: 'fa-hand-holding-dollar',
        gas: 'fa-gas-pump',
        parking: 'fa-square-p'
    };

    // 1. GLOBAL BUDGET VISUALS
    const globalBar = document.getElementById('global-budget-bar');
    const globalGrid = document.getElementById('global-category-grid');

    // Reset
    if (globalBar) globalBar.innerHTML = '';
    if (globalGrid) globalGrid.innerHTML = '';

    // Display Total
    const elGrand = document.getElementById('grand-total');
    if (elGrand) elGrand.textContent = `$${total.toLocaleString()}`;

    // Render Global Elements
    Object.entries(globalCats).forEach(([key, val]) => {
        if (val > 0) {
            const pct = (val / total) * 100;

            // Bar Segment
            // STACKED BAR REMOVED


            // Card
            if (globalGrid) {
                const card = `
                    <div class="budget-card bg-stone-800/80 p-3 rounded-lg flex flex-col justify-between h-20 relative overflow-hidden group hover:bg-stone-800 transition-colors">
                        <div class="flex justify-between items-start relative z-10">
                            <span class="text-xs font-bold text-stone-400 uppercase tracking-wider">${key}</span>
                            <i class="fas ${icons[key]} text-white/40 text-5xl absolute right-4 top-3 transition-transform group-hover:scale-110 drop-shadow-[0_0_12px_rgba(255,255,255,1)]"></i>
                        </div>
                        <div class="flex items-end gap-2 mt-auto relative z-10">
                            <span class="text-xl font-bold text-white">$${val.toLocaleString()}</span>
                        </div>
                    </div>
                `;
                globalGrid.insertAdjacentHTML('beforeend', card);
            }
        }
    });


    // 2. DAILY BUDGET VISUALS
    const dailyBar = document.getElementById('daily-budget-bar');
    const dailyGrid = document.getElementById('daily-category-grid');

    // Reset
    if (dailyBar) dailyBar.innerHTML = '';
    if (dailyGrid) dailyGrid.innerHTML = '';

    // Display Daily Total
    const elDailyCenter = document.getElementById('daily-total-center');
    if (elDailyCenter) elDailyCenter.textContent = `$${dailyAvgTotal.toLocaleString()}`;

    const sortedDaily = Object.entries(dailyAvgBreakdown).sort((a, b) => b[1] - a[1]);

    sortedDaily.forEach(([key, val]) => {
        if (val > 0) {
            const pct = (val / dailyAvgTotal) * 100;
            // Bar
            // STACKED BAR REMOVED


            // Card
            if (dailyGrid) {
                const totalVal = dailyCatTotals[key] || 0;
                const card = `
                    <div class="budget-card bg-stone-800/80 p-2 rounded-lg flex flex-col justify-between h-16 relative overflow-hidden group hover:bg-stone-800 transition-colors">
                        <div class="flex justify-between items-center relative z-10">
                            <span class="text-[10px] font-bold text-stone-400 uppercase tracking-wider">${key}</span>
                                <i class="fas ${icons[key]} text-white/40 text-4xl absolute right-3 top-2 transition-transform group-hover:scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,1)]"></i>
                        </div>
                        <div class="flex items-end gap-2 mt-auto relative z-10">
                            <span class="text-lg font-bold text-white">$${totalVal.toLocaleString()}</span>
                        </div> 
                    </div>
                `;
                dailyGrid.insertAdjacentHTML('beforeend', card);
            }
        }
    });

    // 3. RENDER CHARTS
    renderBudgetCharts(total, globalCats, dailyAvgTotal, dailyAvgBreakdown, colors, icons);
}

function renderBudgetCharts(total, globalCats, dailyAvgTotal, dailyAvgBreakdown, colors, iconsMap) {
    if (typeof Chart === 'undefined') return;

    // Register the datalabels plugin if not already
    if (ChartDataLabels) Chart.register(ChartDataLabels);

    // Update center total text
    const elGlobalCenter = document.getElementById('global-total-center');
    if (elGlobalCenter) elGlobalCenter.textContent = `$${total.toLocaleString()}`;

    // --- 1. GLOBAL DOUGHNUT CHART ---
    const ctxGlobal = document.getElementById('global-pie-chart');
    if (ctxGlobal) {
        if (globalPieChart) globalPieChart.destroy();
        const dataPrepared = Object.entries(globalCats).filter(([k, v]) => v > 0);

        // FontAwesome Unicode Mapping
        const faUnicode = {
            vols: '\uf072', hebergement: '\uf236', transport: '\uf1b9',
            activites: '\uf6ec', epicerie: '\uf291', autres: '\uf141'
        };

        globalPieChart = new Chart(ctxGlobal, {
            type: 'doughnut',
            data: {
                labels: dataPrepared.map(d => d[0].toUpperCase()),
                datasets: [{
                    data: dataPrepared.map(d => d[1]),
                    backgroundColor: dataPrepared.map(d => colors[d[0]]),
                    borderWidth: 0,
                    cutout: '65%' // Thicker ring
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true },
                    datalabels: {
                        color: 'rgba(255,255,255,0.9)',
                        textAlign: 'center',
                        anchor: 'center',
                        align: 'center',
                        formatter: (value, ctx) => {
                            const pct = (value / total * 100).toFixed(0);
                            const key = dataPrepared[ctx.dataIndex][0];
                            const icon = faUnicode[key] || '';
                            // Conditional: Stack for Plane (vols) and Car (transport)
                            if (key === 'vols' || key === 'transport') {
                                return `${icon}\n${pct}%`;
                            }
                            return `${icon} ${pct}%`;
                        },
                        font: (context) => {
                            return {
                                family: '"Font Awesome 6 Free", "Outfit"',
                                weight: 900,
                                size: 20, // Enlarged from 16
                                lineHeight: 1.5
                            };
                        },
                        offset: 0
                    }
                },
                animation: { duration: 1000, easing: 'easeOutQuart' }
            }
        });
    }

    // --- 2. DAILY BAR CHART ---
    const ctxDaily = document.getElementById('daily-bar-chart');
    if (ctxDaily) {
        if (dailyPieChart) dailyPieChart.destroy();
        const dataPrepared = Object.entries(dailyAvgBreakdown)
            .filter(([k, v]) => v > 0)
            .sort((a, b) => b[1] - a[1]);

        dailyPieChart = new Chart(ctxDaily, {
            type: 'bar',
            data: {
                labels: dataPrepared.map(d => d[0].toUpperCase()),
                datasets: [{
                    data: dataPrepared.map(d => d[1]),
                    backgroundColor: dataPrepared.map(d => colors[d[0]] || '#444'),
                    borderRadius: 6,
                    barThickness: 20
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        display: false,
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: '#888', font: { size: 10, weight: 'bold' } },
                        grid: { display: false },
                        border: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: '#ddd',
                        font: { size: 11, weight: 'black' },
                        formatter: (val) => `$${Math.round(val)}`
                    }
                }
            }
        });
    }
}


// --- SETTINGS UI ---
window.openSettings = function () {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    // Populate fields
    document.getElementById('set-gas-price').value = window.itinerarySettings.gas.price;
    document.getElementById('set-gas-cons').value = window.itinerarySettings.gas.consumption;
    document.getElementById('set-gas-tank').value = window.itinerarySettings.gas.tankCapacity;
    document.getElementById('set-gas-threshold').value = window.itinerarySettings.gas.refuelThreshold;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

window.closeSettings = function () {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
};

window.saveSettings = function () {
    window.itinerarySettings.gas.price = parseFloat(document.getElementById('set-gas-price').value) || 0;
    window.itinerarySettings.gas.consumption = parseFloat(document.getElementById('set-gas-cons').value) || 0;
    window.itinerarySettings.gas.tankCapacity = parseFloat(document.getElementById('set-gas-tank').value) || 0;
    window.itinerarySettings.gas.refuelThreshold = parseFloat(document.getElementById('set-gas-threshold').value) || 0;

    localStorage.setItem('steph_itinerary_settings', JSON.stringify(window.itinerarySettings));

    window.updateGlobalBudget();
    renderDetailsGrid(); // App.js function to re-render costs on cards if needed
    window.closeSettings();
};

window.exportBudget = function () {
    const data = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        settings: window.itinerarySettings,
        fixedCosts: window.globalFixedCosts,
        itinerary: window.itineraryState
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "budget_data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    alert("✅ Saved! Now replace budget_data.json in your project folder and push to GitHub.");
};

// --- MISSING FUNCTIONS RESTORED (Prevent Crash) ---

window.populateDefaults = function () {
    // Only set if completely missing/zero to respect manual changes?
    // actually, if it's 0, it might be intentional. 
    // But for "defaults", we usually want them on fresh start.
    // If globalFixedCosts were loaded from storage, they wouldn't be 0 unless manually set to 0.
    // We'll trust the storage loading. 
    // If everything is 0 (fresh load), we set defaults.
    if (window.globalFixedCosts.flights === 0 && window.globalFixedCosts.car === 0) {
        window.globalFixedCosts.flights = 4500;
        window.globalFixedCosts.car = 1200;
    }
};


