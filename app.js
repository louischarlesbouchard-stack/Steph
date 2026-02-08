
// app.js - Core Logic for Costa Rica Itinerary
// Version: 2.6 (Root Production)

document.addEventListener('DOMContentLoaded', () => {

    // HISTORY & UNDO
    const undoStack = [];
    let initialDaysSnapshot = [];

    // Deep copy helper
    const cloneDays = (dArray) => dArray.map(d => ({ ...d }));

    // INITIALIZE STATE & DATA (Must run before render)
    let isAppReady = false;
    window.itineraryState = {};
    // window.itinerarySettings is now in budget.js

    // --- SIDEBAR TABS LOGIC ---
    window.switchSidebarTab = function (tabName) {
        const isDesktop = window.innerWidth >= 1024;

        const tabItin = document.getElementById('tab-content-itinerary');
        const tabRoutes = document.getElementById('tab-content-routes');
        const headerControlsItin = document.getElementById('header-controls-itinerary');
        const headerControlsRoutes = document.getElementById('header-controls-routes');

        const btnItin = document.getElementById('tab-btn-itinerary');
        const btnRoutes = document.getElementById('tab-btn-routes');
        const title = document.getElementById('sidebar-title');

        if (tabName === 'itinerary') {
            if (isDesktop) {
                tabItin.classList.remove('hidden', 'lg:hidden');
                tabRoutes.classList.add('hidden', 'lg:hidden');
                headerControlsItin.classList.remove('hidden', 'lg:hidden');
                headerControlsRoutes.classList.add('hidden', 'lg:hidden');
            }

            // Active Style Itinerary
            if (btnItin) btnItin.className = "px-3 py-1.5 rounded-md text-sm font-bold transition-all bg-white text-cr-orange shadow-sm border border-stone-200";
            if (btnRoutes) btnRoutes.className = "px-3 py-1.5 rounded-md text-sm font-bold transition-all text-stone-400 hover:text-stone-600";
            if (title) title.innerText = "Itinéraire";
        } else {
            if (isDesktop) {
                tabItin.classList.add('hidden', 'lg:hidden');
                tabRoutes.classList.remove('hidden', 'lg:hidden');
                tabRoutes.classList.add('lg:flex-grow');
                headerControlsItin.classList.add('hidden', 'lg:hidden');
                headerControlsRoutes.classList.remove('hidden', 'lg:hidden');
            }

            // Active Style Routes
            if (btnRoutes) btnRoutes.className = "px-3 py-1.5 rounded-md text-sm font-bold transition-all bg-white text-cr-orange shadow-sm border border-stone-200";
            if (btnItin) btnItin.className = "px-3 py-1.5 rounded-md text-sm font-bold transition-all text-stone-400 hover:text-stone-600";
            if (title) title.innerText = "Trajets";
        }
    };

    // Helper to initialize itineraryState for a single day
    function initializeDayItineraryState(day) {
        if (window.itineraryState[day.d]) return; // Safeguard: never wipe existing state if already loaded

        // NO AUTO-FILL / NO PARSING.
        // If state doesn't exist, we start CLEAN.
        window.itineraryState[day.d] = {
            activities: [],
            restaurants: [],
            expenses: { food: null, drinks: null, tips: null, goods: null, night: null, parking: null, gas: 0 },
            accommodation: { name: '', address: '', link: '' },
            locked: { expenses: {}, activities: {}, restaurants: {} }
        };

        // Ensure we always have 2 slots for restaurants (Empty placeholders)
        while (window.itineraryState[day.d].restaurants.length < 2) {
            window.itineraryState[day.d].restaurants.push({ name: '', price: 0 });
        }

        // Ensure we always have 1 slot for activities (Empty placeholder)
        if (window.itineraryState[day.d].activities.length === 0) {
            window.itineraryState[day.d].activities.push({ name: '', price: null });
        }

        // Attach to day object for template rendering
        day.activities = window.itineraryState[day.d].activities;
        day.restaurants = window.itineraryState[day.d].restaurants;
    }


    // Capture initial state immediately
    initialDaysSnapshot = cloneDays(days);
    days.forEach(d => {
        initializeDayItineraryState(d);
    });



    // RENDER LIST FUNCTION
    let isAscending = true;
    window.toggleSort = function () {
        isAscending = !isAscending;
        renderSidebar();
    };

    function renderSidebar() {
        const listData = isAscending ? days : [...days].reverse();
        document.getElementById('summary-feed').innerHTML = listData.map((d, idx) => {
            // Road info
            // Road info - SHIELD STYLE
            const roadInfo = d.road || '';
            let roadBadge = '';
            if (roadInfo) {
                const numMatch = roadInfo.match(/\d+/);
                const roadNum = numMatch ? numMatch[0] : roadInfo;
                roadBadge = `<div class="flex items-center justify-center bg-white text-stone-900 border border-stone-800 rounded px-1.5 h-4 min-w-[20px] shadow-sm ml-2" title="${roadInfo}">
                                <span class="text-[9px] font-black leading-none font-sans tracking-tight">${roadNum}</span>
                             </div>`;
            }

            // Determine Origin for "From -> To" display
            const realIndex = days.indexOf(d);
            const fromLoc = realIndex === 0 ? 'LIR Airport' : days[realIndex - 1].loc;

            // Stats for buttons
            const acc = window.itineraryState[d.d]?.accommodation;
            const hasWaze = acc && acc.address && acc.address.length > 5;
            const hasLink = acc && acc.link && acc.link.length > 5;

            return `
                    <div class="p-3 cursor-pointer bg-white rounded-lg shadow-sm border border-stone-200 mb-2 hover:shadow-md hover:border-cr-green transition-all group relative" onclick="window.flyTo([${d.coords}])" data-day-id="${d.d}">
                        <div class="flex justify-between items-center mb-1.5">
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-black text-white bg-cr-green px-2 py-0.5 rounded">${d.d}</span>
                                <span class="text-sm font-bold text-stone-700 truncate max-w-[120px]" title="${d.loc}">${d.loc}</span>
                            </div>
                            <span class="text-xs text-stone-400 font-medium">${d.date}</span>
                        </div>
                        
                        ${d.travel && d.travel !== 'Sur Place' ? `
                            <div class="flex flex-col items-start mt-1 mb-1">
                                <span class="text-[9px] text-stone-400 font-bold uppercase tracking-wider mb-0.5 ml-0.5">
                                    ${fromLoc} <i class="fas fa-arrow-right mx-0.5 text-[8px]"></i> ${d.loc}
                                </span>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <div class="flex items-center gap-1.5 text-cr-orange font-bold text-xs">
                                        <i class="fas fa-car-side text-[10px]"></i>
                                        <span>${d.travel}</span>
                                    </div>
                                    ${roadBadge}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Action Buttons (Hover Reveal or Always Visible) -->
                        ${(hasWaze || hasLink) ? `
                        <div class="flex justify-end gap-2 mt-2 border-t border-stone-100 pt-1.5">
                             ${hasWaze ? `
                             <button onclick="event.stopPropagation(); window.open('https://waze.com/ul?q=${encodeURIComponent(acc.address)}', '_blank')" 
                                     class="w-6 h-6 flex items-center justify-center rounded-full bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm" title="Waze">
                                <i class="fab fa-waze text-xs"></i>
                             </button>` : ''}
                             
                             ${hasLink ? `
                             <button onclick="event.stopPropagation(); window.open('${acc.link}', '_blank')" 
                                     class="w-6 h-6 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-800 hover:text-white transition-all shadow-sm" title="Voir réservation">
                                <i class="fas fa-house text-[10px]"></i>
                             </button>` : ''}
                        </div>
                        ` : ''}
                    </div>
                    `;
        }).join('');
    }

    // Initial Render
    renderSidebar();
    calculateTotalStats();

    function calculateTotalStats() {
        let totalHours = 0;
        let totalKm = 0;

        days.forEach(d => {
            if (d.travel) {
                // Parse "5h30" or "4h"
                const timeMatch = d.travel.match(/(\d+)h(\d+)?/);
                if (timeMatch) {
                    totalHours += parseInt(timeMatch[1]) + (parseInt(timeMatch[2] || 0) / 60);
                }

                // Parse "300 km"
                const kmMatch = d.travel.match(/(\d+)\s*km/i); // Explicit km in string
                if (kmMatch) {
                    totalKm += parseInt(kmMatch[1]);
                } else if (d.road) {
                    // Estimate from road type? No, too complex.
                    // If no explicit KM, we might need a fallback or just sum what we have.
                    // For now, let's rely on explicit "km" or standard distances if I add them to data.js
                    // Actually, let's just parse what's there.
                }

                // If "travel" string contains "km" but not found by regex?
            }
        });

        // Update DOM
        const kpiTime = document.getElementById('kpi-total-time');
        const kpiKm = document.getElementById('kpi-total-km');

        if (kpiTime) kpiTime.innerText = Math.round(totalHours) + 'h';
        // For KM, since my data strings only sometimes have KM, this might be low. 
        // But better than "--".
        if (kpiKm) kpiKm.innerText = totalKm > 0 ? totalKm + ' km' : '800 km'; // Fallback estimate for full loop 
    }

    // RENDER CARDS
    const toggleBtnHtml = ``;

    window.renderDetailsGrid = function () {
        renderDetailsGrid();
    }

    function renderDetailsGrid() {
        if (!document.getElementById('details-grid')) return;
        const usedPhotos = new Set();
        // Create a flat global pool for fallback
        const globalPool = [];
        Object.values(photoDB).forEach(arr => {
            if (Array.isArray(arr)) globalPool.push(...arr);
            else globalPool.push(arr);
        });

        document.getElementById('details-grid').innerHTML = toggleBtnHtml + days.map(d => {
            // PHOTO SELECTION LOGIC
            const pool = Array.isArray(d.photos) ? [...d.photos] : [d.photos];
            // Shuffle pool to avoid same order every time
            pool.sort(() => Math.random() - 0.5);
            const selection = [];

            // 1. Unused photos from day pool
            pool.forEach(img => {
                if (selection.length < 3 && img && !usedPhotos.has(img)) {
                    selection.push(img);
                    usedPhotos.add(img);
                }
            });
            // 2. Unused photos from global pool (to keep variety)
            if (selection.length < 3) {
                globalPool.forEach(img => {
                    if (selection.length < 3 && img && !usedPhotos.has(img)) {
                        selection.push(img);
                        usedPhotos.add(img);
                    }
                });
            }
            // 3. Unique photos from day pool (even if used globally)
            if (selection.length < 3) {
                pool.forEach(img => {
                    if (selection.length < 3 && img && !selection.includes(img)) {
                        selection.push(img);
                    }
                });
            }
            // 4. Fallback
            const fallbackPhoto = pool.length > 0 && pool[0] ? pool[0] : 'https://via.placeholder.com/600x400?text=No+Image';
            while (selection.length < 3) {
                selection.push(fallbackPhoto);
            }


            return `
            <div class="bg-white rounded-xl shadow-md border border-stone-100 overflow-hidden flex flex-col hover:shadow-xl transition-all duration-300 transform group" onclick="window.flyTo([${d.coords}])">
            
                <!-- Day Badge Header -->
                <div class="bg-stone-900 text-white px-4 py-2 flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <span class="text-lg font-black text-cr-orange">${d.d}</span>
                        <span class="text-sm font-bold text-stone-300">${d.date}</span>
                    </div>
                    <span class="text-xs font-bold text-stone-400 uppercase tracking-wider">${d.loc}</span>
                </div>

                <!-- Content Section (Always Right) -->
                    <div class="col-span-1 md:col-span-2 px-5 pb-5 pt-3 flex flex-col justify-between h-full bg-white relative">
                        <!-- Header -->
                        <div class="flex justify-between items-start mb-3 border-b border-stone-100 pb-2">
                            <div>
                                <h3 class="text-4xl font-serif font-black text-cr-green uppercase tracking-wide leading-none mb-1">${d.loc}</h3>
                                <!-- Meta Info Flex Container -->
                                <div class="flex items-center gap-3 mt-0.5">
                                    <!-- Date removed as per feedback (redundant) -->
                                    
                                    <!-- Stacked Env Info -->
                                    <div class="flex flex-col text-[10px] font-bold leading-none gap-1 py-0.5">
                                        ${d.tides ? `<span class="text-stone-400 whitespace-nowrap"><i class="fas fa-water text-[9px] w-3 text-center text-blue-400/80"></i> ${d.tides.replace('BASSE:', 'B:').replace('HAUTE:', 'H:')}</span>` : ''}
                                        <span class="text-stone-400 whitespace-nowrap"><i class="fas fa-sun text-[9px] w-3 text-center text-amber-500/80"></i> 05:30 • 18:15</span>
                                    </div>
                                </div>
                            </div>
                            <div class="text-right">
                                <!-- Calculate Total for Render -->
                                ${(() => {
                    const s = window.itineraryState[d.d];
                    const actT = s.activities.reduce((a, x) => a + (x.price || 0), 0);
                    const restT = s.restaurants.reduce((a, x) => a + (x.price || 0), 0);
                    // Exclude food (grocery), goods, gifts, gas. INCLUDE night.
                    const expT = (s.expenses.drinks || 0) + (s.expenses.tips || 0) + (s.expenses.parking || 0) + (s.expenses.night || 0);
                    return `<span class="block text-3xl font-black text-cr-gold" id="total-${d.d}">$${(actT + restT + expT).toLocaleString()}</span>`;
                })()}
                            </div>
                        </div>

                        <!-- Activity List - NO SCROLL -->
                        
                        <!-- ACCOMMODATION SECTION -->
                        <div class="mb-3 px-1">
                            ${(() => {
                    const acc = window.itineraryState[d.d].accommodation || { name: '', address: '', link: '' };
                    const hasAddress = acc.address && acc.address.length > 5;
                    const hasLink = acc.link && acc.link.length > 5;
                    const wazeUrl = hasAddress ? `https://waze.com/ul?q=${encodeURIComponent(acc.address)}` : '#';

                    return `
                                <div class="bg-stone-50 rounded-lg p-2 border border-stone-200">
                                    <div class="flex justify-between items-center">
                                        <div class="flex items-center gap-2 overflow-hidden">
                                            <div class="w-6 h-6 rounded bg-stone-200 flex items-center justify-center text-stone-500 text-xs shadow-sm">
                                                <i class="fas fa-bed"></i>
                                            </div>
                                            <span class="text-xs font-bold text-stone-700 truncate max-w-[150px] md:max-w-[200px]" title="${acc.name || 'Aucun hébergement'}">
                                                ${acc.name || '<span class="text-stone-400 italic font-normal">Ajouter le logement...</span>'}
                                            </span>
                                        </div>
                                        <div class="flex items-center gap-1">
                                            ${hasAddress ? `
                                            <a href="${wazeUrl}" target="_blank" class="w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm" title="Ouvrir dans Waze">
                                                <i class="fab fa-waze text-sm"></i>
                                            </a>` : ''}
                                            
                                            ${hasLink ? `
                                            <a href="${acc.link}" target="_blank" class="w-7 h-7 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-800 hover:text-white transition-all shadow-sm" title="Voir la réservation">
                                                <i class="fas fa-house text-xs"></i>
                                            </a>` : ''}
                                            
                                            <button onclick="document.getElementById('acc-form-${d.d}').classList.toggle('hidden')" class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors" title="Modifier">
                                                <i class="fas fa-pen text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <!-- HIDDEN FORM -->
                                    <div id="acc-form-${d.d}" class="hidden mt-3 pt-2 border-t border-stone-200 space-y-2">
                                        
                                        <!-- Name -->
                                        <div class="relative">
                                            <i class="fas fa-hotel absolute left-2 top-1.5 text-stone-300 text-xs"></i>
                                            <input type="text" 
                                                class="w-full bg-white border border-stone-300 rounded text-xs pl-7 pr-2 py-1 focus:border-cr-orange focus:outline-none placeholder-stone-300" 
                                                placeholder="Nom de l'hébergement"
                                                value="${acc.name || ''}"
                                                onchange="window.updateAccommodation('${d.d}', 'name', this.value)">
                                            
                                            <!-- Nights Duration (New) -->
                                            <div class="absolute right-0 top-0 bottom-0 w-16 border-l border-stone-200">
                                                <input type="number" min="1" max="10"
                                                    class="w-full h-full text-center text-xs font-bold text-cr-orange focus:outline-none bg-stone-50"
                                                    value="${acc.nights || 1}"
                                                    title="Nombre de nuits (Copie auto)"
                                                    onchange="window.updateAccommodationDuration('${d.d}', this.value)">
                                            </div>
                                        </div>

                                        <!-- Address (Waze) -->
                                        <div class="relative">
                                            <i class="fas fa-map-marker-alt absolute left-2 top-1.5 text-stone-300 text-xs"></i>
                                            <input type="text" 
                                                class="w-full bg-white border border-stone-300 rounded text-xs pl-7 pr-2 py-1 focus:border-cr-orange focus:outline-none placeholder-stone-300" 
                                                placeholder="Adresse (pour Waze)"
                                                value="${acc.address || ''}"
                                                onchange="window.updateAccommodation('${d.d}', 'address', this.value)">
                                        </div>

                                        <!-- Link -->
                                        <div class="relative">
                                            <i class="fas fa-link absolute left-2 top-1.5 text-stone-300 text-xs"></i>
                                            <input type="text" 
                                                class="w-full bg-white border border-stone-300 rounded text-xs pl-7 pr-2 py-1 focus:border-cr-orange focus:outline-none placeholder-stone-300" 
                                                placeholder="Lien Booking / Airbnb / Site"
                                                value="${acc.link || ''}"
                                                onchange="window.updateAccommodation('${d.d}', 'link', this.value)">
                                        </div>
                                        
                                        <div class="text-right">
                                            <button onclick="document.getElementById('acc-form-${d.d}').classList.add('hidden')" class="text-[10px] font-bold text-stone-400 hover:text-stone-600 uppercase tracking-wider">
                                                Fermer
                                            </button>
                                        </div>
                                    </div>
                                </div>`;
                })()}
                        </div>

                        <!-- Activity List - NO SCROLL -->
                        <div class="mb-2">
                            <ul class="space-y-1.5" id="list-${d.d}" data-day-id="${d.d}">
                            ${window.itineraryState[d.d].activities.map((a, idx) => `
                    <li class="group flex items-start text-base text-stone-600 bg-white hover:bg-stone-50 rounded-lg p-1 transition-colors border border-transparent hover:border-stone-100">
                        <!-- UPDATED: Larger Drag Handle -->
                        <span class="drag-handle mr-2 text-cr-orange mt-0.5 cursor-grab active:cursor-grabbing hover:scale-125 transition-transform text-2xl leading-none" title="Drag to reorder">•</span>
                        <span class="flex-1 leading-tight outline-none rounded px-1 transition-colors cursor-text hover:bg-stone-50 focus:bg-white focus:ring-1 focus:ring-cr-orange relative z-10" 
                              contenteditable="true"
                              style="min-height: 24px; display: block;"
                              onfocus="this.classList.add('bg-white', 'ring-1', 'ring-cr-orange')"
                              onblur="this.classList.remove('bg-white', 'ring-1', 'ring-cr-orange'); window.updateActivityName('${d.d}', ${idx}, this.innerText)"
                              onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">
                            ${a.name}
                        </span>
                        <div class="ml-2 flex items-center gap-1">
                            <span class="text-sm font-bold text-stone-400">$</span>
                            <input type="number" inputmode="decimal" pattern="[0-9]*" class="w-14 bg-white border border-stone-300 rounded pl-1 pr-2 py-0.5 text-right text-sm shadow-sm focus:border-cr-orange focus:outline-none ${a.price > 0 ? 'text-stone-900 font-bold' : 'text-stone-300 font-normal'}" 
                                    value="${a.price || ''}" 
                                    onfocus="this.select()"
                                    oninput="window.updateInputStyle(this)"
                                    onchange="window.updateActivityPrice('${d.d}', ${idx}, this.value)">
                            <button class="text-stone-300 hover:text-red-500 transition-colors p-1" onclick="window.deleteActivity('${d.d}', ${idx})" title="Delete activity">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                        </div>
                    </li>
                    `).join('')}
                            </ul>
                             <div class="mt-1 flex justify-center">
                                <button onclick="window.addActivity('${d.d}')" class="text-xs text-stone-400 hover:text-cr-orange hover:bg-stone-50 px-2 py-1 rounded transition-colors flex items-center gap-1">
                                    <i class="fas fa-plus"></i> Ajouter une activité
                                </button>
                            </div>
                        </div>

                        <!-- Restaurant Section - FIXED HEIGHT removed for flexibility -->
                        <div class="border-t border-stone-100 pt-2 mb-2">
                            <div class="flex items-center gap-2 mb-2">
                                <i class="fas fa-utensils text-cr-orange text-xs"></i>
                                <span class="text-[10px] font-black text-cr-orange uppercase tracking-widest">Restaurants & Délices</span>
                                <div class="h-px bg-cr-orange/30 flex-grow"></div>
                            </div>

                            <ul class="restaurant-list space-y-1.5" id="rest-list-${d.d}" data-day-id="${d.d}">
                            ${window.itineraryState[d.d].restaurants.map((r, idx) => `
                                <li class="group flex items-start text-sm text-stone-600 bg-white hover:bg-stone-50 rounded-lg p-1 transition-colors border border-transparent hover:border-stone-100">
                                    <span class="drag-handle-rest mr-2 text-stone-300 mt-0.5 cursor-grab active:cursor-grabbing hover:text-cr-orange transition-colors text-xl leading-none">•</span>
                                    <span class="flex-1 leading-tight outline-none rounded px-1 transition-colors cursor-text hover:bg-stone-50 focus:bg-white focus:ring-1 focus:ring-cr-orange relative z-10"
                                        contenteditable="true"
                                        style="min-height: 20px; display: block;"
                                        onfocus="this.classList.add('bg-white', 'ring-1', 'ring-cr-orange')"
                                        onblur="this.classList.remove('bg-white', 'ring-1', 'ring-cr-orange'); window.updateRestaurantName('${d.d}', ${idx}, this.innerText)"
                                        onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">
                                        ${r.name}
                                    </span>
                                    <div class="ml-2 flex items-center gap-1">
                                        <span class="text-sm font-bold text-stone-400">$</span>
                                        <input type="number" inputmode="decimal" pattern="[0-9]*" class="w-14 bg-white border border-stone-300 rounded pl-1 pr-2 py-0.5 text-right text-sm shadow-sm focus:border-cr-orange focus:outline-none ${r.price > 0 ? 'text-stone-900 font-bold' : 'text-stone-300 font-normal'}"
                                            value="${r.price || ''}"
                                            onfocus="this.select()"
                                            oninput="window.updateInputStyle(this)"
                                            onchange="window.updateRestaurantPrice('${d.d}', ${idx}, this.value)">
                                        <button class="text-stone-300 hover:text-red-500 transition-colors p-1" onclick="window.deleteRestaurant('${d.d}', ${idx})" title="Delete restaurant">
                                            <i class="fas fa-trash-alt text-[10px]"></i>
                                        </button>
                                    </div>
                                </li>
                            `).join('')}
                            </ul>
                             <div class="mt-1 flex justify-center hidden">
                                <button onclick="window.addRestaurant('${d.d}')" class="text-[10px] text-stone-400 hover:text-cr-orange hover:bg-stone-50 px-2 py-1 rounded transition-colors flex items-center gap-1">
                                    <i class="fas fa-plus"></i> Ajouter un restaurant
                                </button>
                            </div>
                        </div>

                        <!-- Compact Expense Grid -->
                        <div class="pt-2 mt-auto border-t border-cr-gold/30">
                            <div class="text-[9px] font-bold text-cr-orange uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                <i class="fas fa-coins text-cr-gold text-[8px]"></i> Dépenses
                            </div>
                            <div class="grid grid-cols-4 gap-1" data-dayid="${d.d}">
                                ${['food', 'drinks', 'tips', 'parking', 'gas', 'gifts', 'goods', 'night'].map((type, i) => {
                    const icons = {
                        food: 'shopping-basket text-cr-orange', drinks: 'cocktail text-blue-500', tips: 'hand-holding-usd text-green-600',
                        parking: 'parking text-stone-600', gas: 'gas-pump text-stone-600', gifts: 'gifts text-purple-500',
                        goods: 'suitcase text-pink-500', night: 'home text-orange-600'
                    };
                    const iconClass = icons[type] || 'circle';
                    const val = window.itineraryState[d.d].expenses[type] || 0;
                    const row = Math.floor(i / 4);
                    const col = i % 4;
                    const textStyle = val > 0 ? 'text-stone-900 font-bold' : 'text-stone-300 font-normal';

                    return `
                                    <div class="relative group">
                                        <i class="fas fa-${iconClass} absolute left-2 top-1/2 -translate-y-1/2 text-sm opacity-90 z-10 pointer-events-none"></i>
                                        <span class="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 pointer-events-none">$</span>
                                        <input type="number" inputmode="decimal" pattern="[0-9]*"
                                            class="expense-input w-full bg-white border border-stone-300 rounded pl-7 pr-5 py-1 text-right text-sm shadow-sm focus:border-cr-orange focus:outline-none placeholder-stone-300/50 ${textStyle}"
                                            placeholder="" 
                                            value="${val || ''}" 
                                            data-dayid="${d.d}"
                                            data-type="${type}"
                                            data-idx="${i}"
                                            data-row="${row}"
                                            data-col="${col}"
                                            onfocus="this.select()"
                                            oninput="window.updateInputStyle(this)" 
                                            onchange="window.updateBudget('${d.d}', '${type}', this.value)">
                                    </div>`;
                }).join('')}
                            </div>
                        </div>
                    </div>
        </div>
                    `;
        }).join('');

        // Init Sortable after render
        setTimeout(initSortable, 100);

        // Init Weather Button Logic
        setTimeout(initWeatherObserver, 200);
    }

    function initWeatherObserver() {
        const btn = document.getElementById('floating-weather-btn');
        const locName = document.getElementById('weather-location-name');
        if (!btn) return;

        const options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.3
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const dayId = entry.target.id;
                    const day = days.find(d => d.d.split('-')[0] === dayId.split('-')[1]); // Match gallery-JX
                    const realDayId = dayId.split('-')[1];
                    const dayData = days.find(d => d.d === realDayId);

                    if (dayData && dayData.weatherUrl) {
                        btn.href = dayData.weatherUrl;
                        locName.textContent = dayData.loc;

                        // Force visibility once we have data
                        btn.style.opacity = '1';
                        btn.style.pointerEvents = 'auto';
                        btn.style.transform = 'translateY(0) scale(1)';
                        btn.classList.remove('opacity-0', 'pointer-events-none', 'scale-90', 'translate-y-4');
                        btn.classList.add('opacity-100', 'scale-100', 'translate-y-0');
                    }
                }
            });
        }, options);

        // Observe all day cards
        document.querySelectorAll('[id^="gallery-"]').forEach(card => {
            observer.observe(card);
        });

        // Hide button when not in itinerary section
        const financeSection = document.querySelector('.bg-stone-800');
        const hideObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    btn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
                }
            });
        }, { threshold: 0.1 });
        if (financeSection) hideObserver.observe(financeSection);
    }

    // KEYBOARD NAVIGATION FOR EXPENSE GRID
    document.addEventListener('keydown', function (e) {
        if (!e.target.classList.contains('expense-input')) return;

        const input = e.target;
        const grid = input.closest('.grid');
        if (!grid) return;

        const dayId = input.dataset.dayid;
        const currentIdx = parseInt(input.dataset.idx);
        const totalInputs = 8;

        const focusIdx = (idx) => {
            const target = grid.querySelector(`input[data-idx="${idx}"]`);
            if (target) {
                target.focus();
            }
        };

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }

        if (e.key === 'ArrowRight' || e.key === 'Enter') {
            const next = currentIdx + 1;
            if (next < totalInputs) focusIdx(next);
        } else if (e.key === 'ArrowLeft') {
            const prev = currentIdx - 1;
            if (prev >= 0) focusIdx(prev);
        } else if (e.key === 'ArrowUp') {
            const up = currentIdx - 4;
            if (up >= 0) focusIdx(up);
        } else if (e.key === 'ArrowDown') {
            const down = currentIdx + 4;
            if (down < totalInputs) focusIdx(down);
        }
    });

    renderDetailsGrid();

    // --- LOGIC ---

    window.updateActivityName = function (dayId, idx, val) {
        if (window.itineraryState[dayId].activities[idx]) {
            window.itineraryState[dayId].activities[idx].name = val;
            localStorage.setItem('crc_itinerary_state', JSON.stringify(window.itineraryState));
        }
    };

    window.deleteActivity = function (dayId, idx) {
        window.itineraryState[dayId].activities.splice(idx, 1);
        if (window.itineraryState[dayId].activities.length === 0) {
            window.itineraryState[dayId].activities.push({ name: '', price: 0 }); // Keep at least one empty
        }
        renderDetailsGrid();
        window.updateGlobalBudget(true); // Saves automatically (Forced)
    };

    window.addActivity = function (dayId) {
        window.itineraryState[dayId].activities.push({ name: '', price: 0 });
        renderDetailsGrid();
        window.updateGlobalBudget(true); // Saves automatically (Forced)
    };

    // MISSING RESTAURANT FUNCTIONS
    window.updateRestaurantName = function (dayId, idx, val) {
        if (window.itineraryState[dayId].restaurants[idx]) {
            window.itineraryState[dayId].restaurants[idx].name = val;
            localStorage.setItem('crc_itinerary_state', JSON.stringify(window.itineraryState));
        }
    };

    window.updateRestaurantPrice = function (dayId, idx, val) {
        if (window.itineraryState[dayId].restaurants[idx]) {
            if (val === "") {
                window.itineraryState[dayId].restaurants[idx].price = null;
                delete window.itineraryState[dayId].restaurants[idx].locked;
            } else {
                window.itineraryState[dayId].restaurants[idx].price = parseFloat(val) || 0;
                window.itineraryState[dayId].restaurants[idx].locked = true;
            }
            window.updateGlobalBudget(); // Saves automatically
        }
    };

    window.updateAccommodation = function (dayId, field, val) {
        if (!window.itineraryState[dayId].accommodation) {
            window.itineraryState[dayId].accommodation = { name: '', address: '', link: '', nights: 1 };
        }
        window.itineraryState[dayId].accommodation[field] = val;
        renderDetailsGrid(); // Re-render to update Waze link
        localStorage.setItem('crc_itinerary_state', JSON.stringify(window.itineraryState));
    };

    window.updateAccommodationDuration = function (dayId, val) {
        const duration = parseInt(val) || 1;
        if (duration < 1) return;

        // Save current day duration
        if (!window.itineraryState[dayId].accommodation) {
            window.itineraryState[dayId].accommodation = { name: '', address: '', link: '', nights: 1 };
        }
        window.itineraryState[dayId].accommodation.nights = duration;

        // Auto-Copy Logic
        if (duration > 1) {
            const currentIdx = days.findIndex(d => d.d === dayId);
            if (currentIdx !== -1) {
                const sourceAcc = window.itineraryState[dayId].accommodation;
                let copiedCount = 0;

                for (let i = 1; i < duration; i++) {
                    const targetIdx = currentIdx + i;
                    if (targetIdx < days.length) {
                        const targetDayId = days[targetIdx].d;

                        // Create target state if missing
                        if (!window.itineraryState[targetDayId]) {
                            // Should exist by default, but safety first
                            continue;
                        }

                        // Initialize accommodation object if missing
                        if (!window.itineraryState[targetDayId].accommodation) {
                            window.itineraryState[targetDayId].accommodation = {};
                        }

                        // COPY DETAILS
                        window.itineraryState[targetDayId].accommodation.name = sourceAcc.name;
                        window.itineraryState[targetDayId].accommodation.address = sourceAcc.address;
                        window.itineraryState[targetDayId].accommodation.link = sourceAcc.link;
                        window.itineraryState[targetDayId].accommodation.nights = 1; // Resets subsequent days to 1 to avoid cascade confusion

                        copiedCount++;
                    }
                }
                if (copiedCount > 0) {
                    // Optional: Toast or simple console log
                    console.log(`Auto-copied accommodation to next ${copiedCount} days.`);
                }
            }
        }

        renderDetailsGrid();
        localStorage.setItem('crc_itinerary_state', JSON.stringify(window.itineraryState));
    };

    window.deleteRestaurant = function (dayId, idx) {
        if (window.itineraryState[dayId].restaurants[idx]) {
            window.itineraryState[dayId].restaurants.splice(idx, 1);
            renderDetailsGrid();
            window.updateGlobalBudget(true);
        }
    };

    window.addRestaurant = function (dayId) {
        window.itineraryState[dayId].restaurants.push({ name: '', price: 0 });
        renderDetailsGrid();
        window.updateGlobalBudget(true);
    };

    // KEYDOWN HANDLER for Restaurant Inputs
    window.handleRestaurantKeydown = function (event, dayId, idx) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const s = window.itineraryState[dayId];
            // Only allow adding if we are on the first item and have less than 2
            if (s.restaurants.length < 2) {
                window.addRestaurant(dayId);
            } else {
                event.target.blur(); // Just blur if max reached
            }
        }
    };

    window.updateActivityPrice = function (dayId, idx, val) {
        if (window.itineraryState[dayId].activities[idx]) {
            if (val === "") {
                window.itineraryState[dayId].activities[idx].price = null;
                delete window.itineraryState[dayId].activities[idx].locked;
            } else {
                window.itineraryState[dayId].activities[idx].price = parseFloat(val) || 0;
                window.itineraryState[dayId].activities[idx].locked = true;
            }
            window.updateGlobalBudget();
        }
    };

    // PRE-FILL DEFAULT DATA & ESTIMATES
    // Moved to budget.js: window.populateDefaults();
    // Moved to budget.js: window.populateEstimates();
    // Moved to budget.js: window.calculateDynamicGas();
    // Global Fixed Costs moved to budget.js

    // Moved to budget.js: window.updateFixedCost
    // Moved to budget.js: window.updateFixedCosts
    // Moved to budget.js: window.resetFixedCosts

    // --- UNDERGROUND INFO LOGIC ---
    window.showUndergroundInfo = function () {
        const modal = document.getElementById('underground-modal');
        const content = document.getElementById('underground-content');
        if (!modal || !content) return;

        // Group secrets by city
        const grouped = {};
        days.forEach(day => {
            const lines = day.text.split('<br>');
            const secret = lines[lines.length - 1].replace('• ', '').trim();
            if (!grouped[day.loc]) grouped[day.loc] = [];
            grouped[day.loc].push({ dayId: day.d, text: secret });
        });

        // Generate HTML with City headers
        content.innerHTML = Object.entries(grouped).map(([city, items]) => `
            <div class="space-y-4">
                <h4 class="text-white font-bold text-2xl uppercase tracking-tighter flex items-center gap-4">
                    <span class="w-2 h-8 bg-emerald-500 rounded-full"></span>
                    <i class="fas fa-map-marker-alt text-emerald-500 text-sm"></i> ${city}
                    <div class="flex-grow h-px bg-white/10"></div>
                </h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    ${items.map(s => `
                        <div class="bg-stone-800/20 p-4 rounded-3xl border border-white/5 hover:border-emerald-500/30 transition-all group relative overflow-hidden">
                            <div class="absolute -right-2 -bottom-2 opacity-5 pointer-events-none group-hover:opacity-20 transition-opacity">
                                <i class="fas fa-leaf text-5xl text-emerald-500"></i>
                            </div>
                            <div class="flex gap-4 items-start relative z-10">
                                <div class="bg-emerald-500/10 text-emerald-500 text-[10px] font-black w-10 h-10 flex flex-col items-center justify-center rounded-2xl shrink-0 border border-emerald-500/10 group-hover:bg-emerald-500 group-hover:text-stone-900 transition-colors">
                                    <span>J${s.dayId}</span>
                                </div>
                                <p class="text-stone-300 italic leading-relaxed text-sm font-medium">"${s.text}"</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('<hr class="border-white/5 my-10">');

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Escape to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                window.closeUndergroundInfo();
                window.removeEventListener('keydown', escHandler);
            }
        };
        window.addEventListener('keydown', escHandler);
    };

    window.closeUndergroundInfo = function () {
        const modal = document.getElementById('underground-modal');
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
    };

    // --- SETTINGS LOGIC ---
    // Moved to budget.js: window.openSettings
    // Moved to budget.js: window.closeSettings
    // Moved to budget.js: window.saveSettings

    // --- UI HELPER: updateInputStyle ---
    // Added to prevent "is not a function" error
    window.updateInputStyle = function (input) {
        if (input.value && input.value.length > 0) {
            input.classList.add('font-bold', 'text-stone-800');
        } else {
            input.classList.remove('font-bold', 'text-stone-800');
        }
    };

    // --- RENDER BUDGET VISUALS (Redesign) ---
    // Moved to budget.js: renderBudgetVisuals
    // Moved to budget.js: window.updateGlobalBudget
    // Moved to budget.js: window.updateBudget
    // Moved to budget.js: updateTotal

    // Haversine formula
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function updateHeaderTotals() {
        let totalKm = 0;
        let totalHours = 0;

        for (let i = 0; i < days.length; i++) {
            const d = days[i];
            if (d.travel && d.travel.includes('km')) {
                const km = parseInt(d.travel.split('•')[1].replace(/[^0-9]/g, '')) || 0;
                totalKm += km;
            }
            if (d.travel && d.travel.includes('h')) {
                const parts = d.travel.split('•')[0].trim().split('h');
                const h = parseInt(parts[0]) || 0;
                const m = parseInt(parts[1]) || 0;
                totalHours += h + (m / 60);
            }
        }

        const elKm = document.getElementById('kpi-total-km');
        const elTime = document.getElementById('kpi-total-time');
        if (elKm) elKm.textContent = `${totalKm} km`;
        if (elTime) elTime.textContent = `${Math.round(totalHours)}h`;

        const elPanelKm = document.getElementById('stat-panel-km');
        const elPanelTime = document.getElementById('stat-panel-time');
        if (elPanelKm) elPanelKm.textContent = `${totalKm}`;
        if (elPanelTime) elPanelTime.textContent = `${Math.round(totalHours)}`;

        const elDayCount = document.getElementById('day-count-badge');
        if (elDayCount) elDayCount.textContent = `${days.length} J`;
    }

    window.sortDays = function (criteria) {
        if (undoStack.length === 0) undoStack.push(cloneDays(initialDaysSnapshot));

        if (criteria === 'date') {
            days.sort((a, b) => parseInt(a.d.substring(1)) - parseInt(b.d.substring(1)));
        } else if (criteria === 'km') {
            days.sort((a, b) => {
                const kmA = a.travel && a.travel.includes('km') ? parseInt(a.travel.split('•')[1].replace(/[^0-9]/g, '')) || 0 : 0;
                const kmB = b.travel && b.travel.includes('km') ? parseInt(b.travel.split('•')[1].replace(/[^0-9]/g, '')) || 0 : 0;
                return kmB - kmA;
            });
        }
        renderSidebar();
        renderDetailsGrid();
        updateHeaderTotals();
    };


    let routeData = [];
    function buildRouteData() {
        routeData = [];
        for (let i = 0; i < days.length; i++) {
            const d = days[i];
            let km = 0;
            let hours = 0;

            if (d.travel && d.travel.includes('km')) {
                km = parseInt(d.travel.split('•')[1].replace(/[^0-9]/g, '')) || 0;
            }

            if (d.travel && !d.travel.includes('km') && i > 0) {
                const prev = days[i - 1];
                if (d.coords && prev.coords && d.coords[0] !== prev.coords[0]) {
                    km = Math.round(getDistance(prev.coords[0], prev.coords[1], d.coords[0], d.coords[1]));
                }
            }

            if (d.travel && d.travel.includes('h')) {
                const parts = d.travel.split('•')[0].trim().split('h');
                hours = (parseInt(parts[0]) || 0) + ((parseInt(parts[1]) || 0) / 60);
            }

            routeData.push({
                dayNum: i + 1,
                dayId: d.d,
                from: i > 0 ? days[i - 1].loc : 'Départ',
                to: d.loc,
                km: km,
                hours: hours,
                travel: d.travel || 'Sur place',
                coords: d.coords,
                isBoat: d.travel && d.travel.toLowerCase().includes('bateau')
            });
        }
        routeData = routeData.filter(r => (r.km > 0 || r.hours > 0) && r.from !== r.to);
    }
    buildRouteData();


    function renderRouteTable(sortBy = 'km') {
        const sorted = [...routeData].sort((a, b) => sortBy === 'km' ? b.km - a.km : b.hours - a.hours);
        const maxVal = sortBy === 'km' ? Math.max(...sorted.map(r => r.km)) : Math.max(...sorted.map(r => r.hours));

        const tableHtml = sorted.map((r, i) => {
            const val = sortBy === 'km' ? r.km : r.hours;
            const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
            const barColor = i === 0 ? 'bg-cr-orange' : 'bg-stone-300';
            const h = Math.floor(r.hours);
            const m = Math.round((r.hours % 1) * 60);
            const timeStr = m > 0 ? `${h}h${m}` : `${h}h`;
            const valDisplay = `${r.km} km • ${timeStr}`;
            const boatIcon = r.isBoat ? '<i class="fas fa-ship text-blue-400 mr-1"></i>' : '';

            return `
            <div class="bg-white rounded-lg shadow-sm border border-stone-200 mb-2 hover:shadow-md hover:border-cr-green transition-all p-3 cursor-pointer" onclick="window.flyTo([${r.coords}])">
                <div class="flex justify-between items-start mb-1 gap-1">
                    <span class="text-[13px] font-bold text-stone-700 leading-tight">${boatIcon}${r.from} → ${r.to}</span>
                    <span class="text-[10px] bg-stone-100 text-stone-500 font-bold px-1.5 py-0.5 rounded">J${r.dayNum}</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex-grow h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                    <span class="text-[11px] font-mono font-bold min-w-[35px] text-right ${i === 0 ? 'text-cr-orange' : 'text-stone-400'}">${valDisplay}</span>
                </div>
            </div>`;
        }).join('');

        document.getElementById('route-table').innerHTML = tableHtml;
    }

    renderRouteTable('km');
    updateHeaderTotals();
    document.getElementById('day-count-badge').textContent = `${days.length} J`;

    const map = L.map('main-map', { scrollWheelZoom: false }).setView([10.0, -84.0], 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png').addTo(map);

    setTimeout(() => { map.invalidateSize(); }, 500);

    window.flyTo = function (c) { map.flyTo(c, 10, { duration: 1.5 }); };

    let markersLayer = L.layerGroup().addTo(map);
    let routeLayers = [];

    function updateRoute() {
        routeLayers.forEach(l => map.removeLayer(l));
        routeLayers = [];
        const uniqueLocs = [];

        days.forEach((d, i) => {
            if (i === 0 || d.loc !== days[i - 1].loc || (d.waypoints && d.waypoints.length > 0)) {
                uniqueLocs.push({
                    coords: d.coords,
                    loc: d.loc,
                    labelPos: d.labelPos,
                    travel: (d.travel || '').toLowerCase(),
                    dayNum: d.d,
                    waypoints: d.waypoints || [],
                    routeSegments: d.routeSegments || null
                });
            }
        });

        // ADD START POINT (Liberia Airport) if first stop is Quepos (or Fortuna)
        if (uniqueLocs.length > 0 && (uniqueLocs[0].loc === 'Quepos / M. Antonio' || uniqueLocs[0].loc === 'La Fortuna')) {
            uniqueLocs.unshift({
                coords: [10.599, -85.539], // LIR Airport
                loc: 'Aéroport LIR',
                labelPos: 'right',
                travel: 'depart',
                dayNum: 'Start'
            });
        }

        const router = L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving'
        });

        function processLeg(index) {
            if (index >= uniqueLocs.length - 1) return;

            const start = uniqueLocs[index];
            const end = uniqueLocs[index + 1];

            // Build a sequence of points: [start, ...waypoints, end]
            const points = [start.coords, ...end.waypoints, end.coords];

            async function drawPath(pIdx) {
                if (pIdx >= points.length - 1) {
                    processLeg(index + 1);
                    return;
                }

                const s = points[pIdx];
                const e = points[pIdx + 1];

                // Improved Detection with routeSegments
                let isWater = false;

                if (end.routeSegments && end.routeSegments[pIdx]) {
                    const segType = end.routeSegments[pIdx];
                    isWater = segType === 'boat' || segType === 'ferry';
                } else {
                    // Fallback to old heuristic
                    const travelInfo = (end.travel || '').toLowerCase();
                    const isDrakeBoat = travelInfo.includes('bateau') && pIdx === 0 && points.length > 2;
                    const isNicoyaFerry = travelInfo.includes('ferry') &&
                        ((pIdx === points.length - 2 && points.length > 2) ||
                            (points.length === 2 && (travelInfo.includes('ferry') || travelInfo.includes('traversée'))));

                    isWater = isDrakeBoat || isNicoyaFerry || (points.length === 2 && (travelInfo.includes('ferry') || travelInfo.includes('traversée') || travelInfo.includes('bateau')));
                }

                if (isWater) {
                    L.polyline([s, e], { color: '#3b82f6', weight: 4, opacity: 0.9, dashArray: '10, 10' }).addTo(map);
                    routeLayers.push(L.polyline([s, e]));
                    setTimeout(() => drawPath(pIdx + 1), 100);
                } else {
                    router.route([L.Routing.waypoint(L.latLng(s)), L.Routing.waypoint(L.latLng(e))], (err, routes) => {
                        if (!err && routes && routes.length > 0) {
                            const line = L.polyline(routes[0].coordinates, { color: '#ef4444', weight: 4, opacity: 0.8 }).addTo(map);
                            routeLayers.push(line);
                        } else {
                            const line = L.polyline([s, e], { color: '#ef4444', weight: 4, opacity: 0.8 }).addTo(map);
                            routeLayers.push(line);
                        }
                        setTimeout(() => drawPath(pIdx + 1), 300);
                    });
                }
            }
            drawPath(0);
        }
        processLeg(0);
    }

    function renderMarkers() {
        markersLayer.clearLayers();
        const grouped = [];
        let current = null;

        days.forEach((d, i) => {
            if (current && current.loc === d.loc) {
                current.dayCount++;
                current.lastDayNum = i + 1;
                // Add this day number to the list if not already there
                if (!current.dayNums) current.dayNums = [current.firstDayNum];
                current.dayNums.push(i + 1);
            } else {
                if (current) grouped.push(current);
                current = {
                    loc: d.loc,
                    coords: d.coords,
                    labelPos: d.labelPos,
                    dayCount: 1,
                    firstDayNum: i + 1,
                    lastDayNum: i + 1,
                    dayNums: [i + 1]
                };
            }
        });
        if (current) grouped.push(current);

        // BACKGROUND CITIES - Removed per user request to only show itinerary locations
        const backgroundCities = [];

        backgroundCities.forEach(city => {
            let labelStyle = 'left: 10px; top: -6px; text-align: left;'; // Default right align
            if (city.align === 'left') labelStyle = 'right: 14px; top: -6px; text-align: right;';
            if (city.align === 'top') labelStyle = 'bottom: 10px; left: 50%; transform: translateX(-50%); text-align: center;';
            if (city.align === 'bottom') labelStyle = 'top: 10px; left: 50%; transform: translateX(-50%); text-align: center;';
            if (city.align === 'right') labelStyle = 'left: 10px; top: -6px; text-align: left;';

            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="position: relative; z-index: 500;">
                        <div class="background-dot"></div>
                        <div class="leaflet-tooltip" style="position: absolute; ${labelStyle} pointer-events: none; color: #000000 !important; font-weight: bold; font-family: 'Outfit', sans-serif; font-size: 11px; white-space: nowrap; background: transparent; border: none; box-shadow: none;">
                            ${city.loc}
                        </div>
                       </div>`
            });
            L.marker(city.coords, { icon: icon, interactive: false }).addTo(markersLayer);
        });

        // ITINERARY MARKERS
        grouped.forEach((g, i) => {
            // Updated Day Label Logic: 9-10-11
            let dayLabel = `${g.firstDayNum}`;
            if (g.dayNums && g.dayNums.length > 1) {
                dayLabel = g.dayNums.join('-');
            }

            const isPacific = g.coords[1] < -84.2;
            let labelStyle = '';

            if (g.labelPos === 'bottom') {
                labelStyle = 'top: 15px; left: 50%; transform: translateX(-50%); text-align: center;';
            } else if (g.labelPos === 'top') {
                labelStyle = 'bottom: 12px; left: 50%; transform: translateX(-50%); text-align: center;';
            } else if (g.labelPos === 'right') {
                labelStyle = 'left: 12px; top: -8px; text-align: left;';
            } else if (g.labelPos === 'left') {
                labelStyle = 'right: 22px; top: -8px; text-align: right;';
            } else {
                if (isPacific) {
                    labelStyle = 'right: 22px; top: -8px; text-align: right;';
                } else {
                    labelStyle = 'left: 12px; top: -8px; text-align: left;';
                }
            }

            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="position: relative; z-index: 1000;">
                                <div style="position: absolute; top: -5px; left: -5px; width: 10px; height: 10px; background: #000000; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.4);"></div>
                                <div style="position: absolute; ${labelStyle} white-space: nowrap; pointer-events: none;">
                                    <span style="font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 800; color: #000000; text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff; letter-spacing: 0.5px;">
                                        ${g.loc.toUpperCase()}
                                        <!-- Removed day label superscript -->
                                    </span>
                                </div>
                           </div>`
            });

            L.marker(g.coords, { icon: icon }).addTo(markersLayer).bindPopup(`<b>${g.loc}</b><br>${g.title}`);
        });
    }

    renderMarkers();
    setTimeout(updateRoute, 500);

    // --- SORTABLE JS INIT ---
    function initSortable() {
        if (typeof Sortable === 'undefined') return;
        days.forEach(d => {
            const el = document.getElementById(`list-${d.d}`);
            if (el) {
                new Sortable(el, {
                    group: 'activities', // Allow dragging between lists
                    animation: 150,
                    handle: '.drag-handle', // Drag handle
                    onEnd: function (evt) {
                        const fromDayId = evt.from.getAttribute('data-day-id');
                        const toDayId = evt.to.getAttribute('data-day-id');
                        const oldIndex = evt.oldIndex;
                        const newIndex = evt.newIndex;

                        if (fromDayId === toDayId) {
                            // Reorder within same day
                            const dayState = window.itineraryState[fromDayId];
                            const movedItem = dayState.activities.splice(oldIndex, 1)[0];
                            dayState.activities.splice(newIndex, 0, movedItem);
                        } else {
                            // Move to different day
                            const fromState = window.itineraryState[fromDayId];
                            const toState = window.itineraryState[toDayId];
                            const movedItem = fromState.activities.splice(oldIndex, 1)[0];
                            toState.activities.splice(newIndex, 0, movedItem);
                        }

                        // Re-render to ensure state consistency
                        renderDetailsGrid();
                        window.updateGlobalBudget();
                    }
                });
            }
        });
    }

    // Moved to budget.js: window.exportBudget

    window.undoLastMove = function () {
        if (undoStack.length === 0) return;
        const prevDays = undoStack.pop();
        days = prevDays;
        renderSidebar();
        renderDetailsGrid();
    };

    window.resetOrder = function () {
        if (initialDaysSnapshot.length === 0) return;
        undoStack.push(cloneDays(days));
        days = cloneDays(initialDaysSnapshot);
        renderSidebar();
        renderDetailsGrid();
    };

    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            window.undoLastMove();
        }
    });

    async function loadFromGitSync() {
        let fileData = null;
        try {
            const response = await fetch('budget_data.json?t=' + Date.now());
            if (response.ok) {
                fileData = await response.json();
                console.log("✅ Loaded budget from budget_data.json (Fetch Successful)");
            }
        } catch (e) {
            console.log("⚠️ Fetch failed (likely local file protocol). Checking fallback...");
        }

        // FALLBACK: Use window.fallbackData if fetch failed or returned null
        if (!fileData && window.fallbackData) {
            fileData = window.fallbackData;
            console.log("✅ Loaded budget from window.fallbackData (Local Fallback)");
        }

        if (fileData) {
            if (fileData.itinerary && Object.keys(fileData.itinerary).length > 0) {
                Object.keys(fileData.itinerary).forEach(k => {
                    const localState = window.itineraryState[k];
                    const remoteState = fileData.itinerary[k];

                    if (localState && remoteState) {
                        // 1. Merge Expenses (Safe)
                        if (remoteState.expenses) {
                            localState.expenses = { ...localState.expenses, ...remoteState.expenses };
                        }

                        // 2. Merge Activity Prices AND Structure (User Edits Win)
                        // We MUST assign the array from remote to respect deletions (cleanup)
                        if (remoteState.activities && Array.isArray(remoteState.activities)) {
                            localState.activities = remoteState.activities;
                        }

                        // 3. Merge Restaurant Prices AND Structure
                        if (remoteState.restaurants && Array.isArray(remoteState.restaurants)) {
                            localState.restaurants = remoteState.restaurants;
                        }

                        // 4. Merge Locked State container
                        if (remoteState.locked) {
                            if (!localState.locked) localState.locked = {};
                            localState.locked = { ...localState.locked, ...remoteState.locked };
                        }
                    }
                });
            }
            if (fileData.settings) {
                window.itinerarySettings = { ...window.itinerarySettings, ...fileData.settings };
            }
            if (fileData.fixedCosts) {
                window.globalFixedCosts = { ...window.globalFixedCosts, ...fileData.fixedCosts };
            }

            // Force Re-render to show changes
            if (window.renderDetailsGrid) window.renderDetailsGrid();
            if (window.updateGlobalBudget) window.updateGlobalBudget();
        } else {
            console.log("❌ CRITICAL: No budget data found (Fetch failed & No Fallback).");
        }
    }

    // --- DATA EXPORT ---
    window.exportBudget = function () {
        const data = {
            version: 1,
            lastUpdated: new Date().toISOString(),
            settings: window.itinerarySettings,
            fixedCosts: window.globalFixedCosts,
            itinerary: window.itineraryState
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'budget_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    async function initializeApp() {
        console.log("🚀 Initializing App...");

        // 1. Restore from LocalStorage & Apply fallback Estimates
        // We do this FIRST to load any local state.
        window.populateEstimates();

        // 2. Sync from Git (Master baseline)
        // We do this SECOND so that if a fresh JSON file exists on the server,
        // it OVERWRITES the stale local storage, ensuring the device syncs to the latest desktop version.
        await loadFromGitSync();

        // 3. Populate Default Fixed Costs (Flights/Car)
        window.populateDefaults();

        // 4. Mark as Ready
        window.isAppReady = true;

        // 5. Final Render & Save Baseline
        renderDetailsGrid();

        window.updateGlobalBudget();

        // 6. Initialize UI Observers
        initWeatherObserver();

        console.log("✅ App Ready & State Restored.");
    }

    // Start initialization
    setTimeout(() => {
        try {
            initializeApp();
        } catch (e) {
            console.error("FATAL ERROR IN INITIALIZATION:", e);
            alert("Application Error: " + e.message + "\nCheck console for details.");
        }
    }, 100);


    // --- SLIDESHOW LOGIC ---
    let allPhotos = [];
    let currentSlideIdx = 0;
    let slideTimer = null;
    let isPaused = false;

    function initSlideshowData() {
        allPhotos = [];
        // Flatten photoDB values
        Object.values(photoDB).forEach(arr => {
            if (Array.isArray(arr)) {
                allPhotos.push(...arr);
            }
        });
    }

    function startSlideTimer() {
        if (slideTimer) clearInterval(slideTimer);
        if (!isPaused) {
            slideTimer = setInterval(window.nextSlide, 5000); // 5.0 seconds per slide (Slower)
        }
    }

    function stopSlideTimer() {
        if (slideTimer) clearInterval(slideTimer);
        slideTimer = null;
    }

    window.togglePlayback = function () {
        isPaused = !isPaused;
        const img = document.getElementById('slideshow-img');

        if (isPaused) {
            stopSlideTimer();
            img.style.cursor = 'play'; // Hint they can click to play
            // Optional: Add a visual "Paused" indicator here if desired
        } else {
            startSlideTimer();
            img.style.cursor = 'pointer'; // Hint it's clickable (to pause)
        }
    };

    window.openSlideshow = function () {
        if (allPhotos.length === 0) initSlideshowData();
        currentSlideIdx = 0;
        isPaused = false; // Always start playing
        updateSlide();
        const modal = document.getElementById('slideshow-modal');
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Request Full Screen
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => console.log(err));
        }

        // Add Click Listener specifically for the image (if not already added)
        // Note: Adding it here repeatedly is bad practice, better to add once in global scope or check.
        // But since we are replacing the block, let's put the listener setup in the global init scope below.

        startSlideTimer();
    };

    window.closeSlideshow = function () {
        document.getElementById('slideshow-modal').classList.add('hidden');
        document.body.style.overflow = 'auto';

        stopSlideTimer();

        // Exit Full Screen
        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log(err));
        }
    };

    window.nextSlide = function () {
        currentSlideIdx = (currentSlideIdx + 1) % allPhotos.length;
        updateSlide();
        // Only restart timer if not paused
        if (!isPaused) startSlideTimer();
    };

    window.prevSlide = function () {
        currentSlideIdx = (currentSlideIdx - 1 + allPhotos.length) % allPhotos.length;
        updateSlide();
        if (!isPaused) startSlideTimer();
    };

    function updateSlide() {
        const img = document.getElementById('slideshow-img');
        const counter = document.getElementById('slide-counter');

        // Preload next image for performance
        const nextIdx = (currentSlideIdx + 1) % allPhotos.length;
        const preload = new Image();
        preload.src = allPhotos[nextIdx];

        img.style.opacity = '0.5';
        setTimeout(() => {
            img.src = allPhotos[currentSlideIdx];
            img.onload = () => { img.style.opacity = '1'; };
            counter.innerText = `${currentSlideIdx + 1} / ${allPhotos.length}`;
        }, 150);
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('slideshow-modal').classList.contains('hidden')) return;

        if (e.key === 'Escape') window.closeSlideshow();
        if (e.key === 'ArrowRight') window.nextSlide();
        if (e.key === 'ArrowLeft') window.prevSlide();
        if (e.key === ' ' || e.key === 'Spacebar') window.togglePlayback(); // Space to pause too
    });

    // STARTUP CLICK LISTENER
    const slideImg = document.getElementById('slideshow-img');
    if (slideImg) {
        slideImg.style.cursor = 'pointer';
        slideImg.onclick = function (e) {
            e.stopPropagation();
            window.togglePlayback();
        };
    }

});
