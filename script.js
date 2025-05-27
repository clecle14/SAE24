// Configuration de l'API
const API_TOKEN = '1fe33308524f0f982b8e21001c4e926d69b2813e2f0d7ae88f00a0aad741c31c';
const API_BASE_URL = 'https://api.meteo-concept.com/api';

// Variables globales
let currentCityData = null;
let darkMode = false;
let selectedDays = 3; // Valeur par défaut
let map = null; // Variable pour la carte Leaflet
let isDragging = false;

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Initialiser le sélecteur à cadran
    initializeDialSelector();

    // Gestion du formulaire
    document.getElementById('weatherForm').addEventListener('submit', handleFormSubmit);

    // Gestion du mode sombre
    document.querySelector('.dark-mode-toggle').addEventListener('click', toggleDarkMode);

    // Charger les préférences sauvegardées
    loadUserPreferences();
}

function initializeDialSelector() {
    const dialSelector = document.getElementById('dialSelector');
    const daysDisplay = dialSelector.querySelector('.days-display');
    const dialNumbers = dialSelector.querySelectorAll('.dial-number');
    const dialKnob = dialSelector.querySelector('.dial-knob');

    // Gestion des clics sur les numéros
    dialNumbers.forEach(number => {
        number.addEventListener('click', () => {
            selectedDays = parseInt(number.dataset.days);
            updateDialSelector();
        });
    });

    // Gestion de la navigation au clavier
    dialSelector.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            selectedDays = Math.max(1, selectedDays - 1);
            updateDialSelector();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            selectedDays = Math.min(7, selectedDays + 1);
            updateDialSelector();
        } else if (e.key >= '1' && e.key <= '7') {
            selectedDays = parseInt(e.key);
            updateDialSelector();
        }
    });

    // Gestion du drag pour le cadran
    let startAngle = 0;
    let currentAngle = 0;

    dialKnob.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = dialKnob.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI) - currentAngle;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = dialKnob.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
        currentAngle = angle - startAngle;
        // Calculer le jour le plus proche
        const dayIndex = Math.round((currentAngle % 360) / 51.43) % 7;
        selectedDays = dayIndex < 0 ? 7 + dayIndex : dayIndex + 1;
        updateDialSelector();
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Mettre à jour l'affichage initial
    updateDialSelector();
}

function updateDialSelector() {
    const dialSelector = document.getElementById('dialSelector');
    const daysDisplay = dialSelector.querySelector('.days-display');
    const dialNumbers = dialSelector.querySelectorAll('.dial-number');
    const dialKnob = dialSelector.querySelector('.dial-knob');

    // Mettre à jour la classe selected
    dialNumbers.forEach(number => {
        if (parseInt(number.dataset.days) === selectedDays) {
            number.classList.add('selected');
        } else {
            number.classList.remove('selected');
        }
    });

    // Mettre à jour la rotation du cadran
    const angle = (selectedDays - 1) * 51.43; // 360° / 7 ≈ 51.43°
    dialKnob.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;

    // Mettre à jour le texte
    daysDisplay.textContent = `${selectedDays} jour${selectedDays > 1 ? 's' : ''}`;

    // Mettre à jour ARIA
    dialSelector.setAttribute('aria-valuenow', selectedDays);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const cityName = document.getElementById('cityInput').value.trim();
    if (!cityName) return;

    // Sauvegarder les préférences
    saveUserPreferences();

    try {
        // Afficher le loading
        showLoading();
        
        // Rechercher la ville
        const cityData = await searchCity(cityName);
        currentCityData = cityData;
        
        // Récupérer les prévisions
        const forecasts = await getWeatherForecast(cityData.insee, selectedDays);
        
        // Afficher les résultats
        displayWeatherData(forecasts, cityData);
        displayMapIfNeeded(cityData);
        
    } catch (error) {
        showError('Erreur lors de la récupération des données : ' + error.message);
    }
}

async function searchCity(cityName) {
    const response = await fetch(`${API_BASE_URL}/location/cities?token=${API_TOKEN}&search=${encodeURIComponent(cityName)}`);
    
    if (!response.ok) {
        throw new Error('Erreur lors de la recherche de la ville');
    }
    
    const data = await response.json();
    
    if (!data.cities || data.cities.length === 0) {
        throw new Error('Aucune ville trouvée avec ce nom');
    }
    
    return data.cities[0]; // Prendre la première ville trouvée
}

async function getWeatherForecast(insee, days) {
    const response = await fetch(`${API_BASE_URL}/forecast/daily?token=${API_TOKEN}&insee=${insee}`);
    
    if (!response.ok) {
        throw new Error('Erreur lors de la récupération des prévisions');
    }
    
    const data = await response.json();
    
    if (!data.forecast || !Array.isArray(data.forecast)) {
        throw new Error('Données de prévision invalides');
    }
    
    console.log('Structure complète de la réponse de l\'API:', JSON.stringify(data, null, 2));
    
    if (data.forecast.length < days) {
        throw new Error(`Données insuffisantes : seulement ${data.forecast.length} jour(s) disponible(s)`);
    }
    
    return data.forecast.slice(0, days);
}

function displayWeatherData(forecasts, cityData) {
    const container = document.getElementById('weatherContainer');
    container.innerHTML = '';

    forecasts.forEach((forecast, index) => {
        const card = createWeatherCard(forecast, index === 0 ? 'Aujourd\'hui' : null);
        card.style.animationDelay = `${index * 0.1}s`;
        container.appendChild(card);
    });
}

function createWeatherCard(forecast, dayLabel) {
    const card = document.createElement('div');
    card.className = 'weather-card';

    const date = new Date(forecast.datetime);
    const dateStr = dayLabel || date.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
    });

    const weatherIcon = getWeatherIcon(forecast.weather);
    const weatherDesc = getWeatherDescription(forecast.weather);

    let additionalInfo = '';
    
    if (document.getElementById('showRain').checked && forecast.rr1 != null) {
        additionalInfo += `<div class="detail-item"><span>Pluie :</span><span>${forecast.rr1} mm</span></div>`;
    }
    
    if (document.getElementById('showWind').checked && forecast.wind10m != null) {
        additionalInfo += `<div class="detail-item"><span>Vent :</span><span>${forecast.wind10m} km/h</span></div>`;
    }
    
    if (document.getElementById('showWindDirection').checked && forecast.dirwind10m != null) {
        const windDir = getWindDirection(forecast.dirwind10m);
        additionalInfo += `<div class="detail-item"><span>Direction vent :</span><span>${windDir} (${forecast.dirwind10m}°)</span></div>`;
    }

    card.innerHTML = `
        <div class="weather-header">
            <div class="weather-date">${dateStr}</div>
            <div class="weather-temp">${Math.round(forecast.tmax)}°C</div>
        </div>
        <div class="weather-main">
            <div class="weather-icon">${weatherIcon}</div>
            <div>
                <div class="weather-desc">${weatherDesc}</div>
                <div style="color: #636e72;">Min: ${Math.round(forecast.tmin)}°C | Max: ${Math.round(forecast.tmax)}°C</div>
            </div>
        </div>
        <div class="weather-details">
            ${additionalInfo}
        </div>
    `;

    return card;
}

function displayMapIfNeeded(cityData) {
    const showLat = document.getElementById('showLatitude').checked;
    const showLng = document.getElementById('showLongitude').checked;
    const mapContainer = document.getElementById('mapContainer');

    if (showLat || showLng) {
        document.getElementById('latitudeDisplay').textContent = showLat ? cityData.latitude.toFixed(6) : '-';
        document.getElementById('longitudeDisplay').textContent = showLng ? cityData.longitude.toFixed(6) : '-';
        mapContainer.style.display = 'block';

        if (!map) {
            map = L.map('map').setView([cityData.latitude, cityData.longitude], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
        } else {
            map.setView([cityData.latitude, cityData.longitude], 13);
        }

        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        L.marker([cityData.latitude, cityData.longitude])
            .addTo(map)
            .bindPopup(`<b>${cityData.name}</b>`)
            .openPopup();
    } else {
        mapContainer.style.display = 'none';
    }
}

function getWeatherIcon(weatherCode) {
    const icons = {
        0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 4: '🌫️',
        10: '🌦️', 11: '🌧️', 12: '🌧️', 13: '🌨️', 14: '❄️',
        20: '🌦️', 21: '🌧️', 22: '❄️', 30: '⛈️', 31: '⛈️', 32: '⛈️',
        40: '🌧️', 41: '🌧️'
    };
    return icons[weatherCode] || '🌤️';
}

function getWeatherDescription(weatherCode) {
    const descriptions = {
        0: 'Soleil', 1: 'Peu nuageux', 2: 'Ciel voilé', 3: 'Nuageux', 4: 'Très nuageux',
        10: 'Pluie faible', 11: 'Pluie modérée', 12: 'Pluie forte', 13: 'Pluie faible verglaçante',
        14: 'Pluie modérée verglaçante', 20: 'Neige faible', 21: 'Neige modérée', 22: 'Neige forte',
        30: 'Pluie et neige mêlées faibles', 31: 'Pluie et neige mêlées modérées', 32: 'Pluie et neige mêlées fortes',
        40: 'Averses faibles', 41: 'Averses modérées'
    };
    return descriptions[weatherCode] || 'Temps variable';
}

function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

function showLoading() {
    const container = document.getElementById('weatherContainer');
    container.innerHTML = '<div class="loading">Chargement des prévisions...</div>';
}

function showError(message) {
    const container = document.getElementById('weatherContainer');
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

function toggleDarkMode() {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode');
    const button = document.querySelector('.dark-mode-toggle');
    button.textContent = darkMode ? '☀️' : '🌙';
    button.setAttribute('aria-label', darkMode ? 'Désactiver le mode sombre' : 'Activer le mode sombre');
    
    localStorage.setItem('darkMode', darkMode);
}

function saveUserPreferences() {
    const prefs = {
        city: document.getElementById('cityInput').value,
        days: selectedDays,
        showLatitude: document.getElementById('showLatitude').checked,
        showLongitude: document.getElementById('showLongitude').checked,
        showRain: document.getElementById('showRain').checked,
        showWind: document.getElementById('showWind').checked,
        showWindDirection: document.getElementById('showWindDirection').checked
    };
    localStorage.setItem('weatherPrefs', JSON.stringify(prefs));
}

function loadUserPreferences() {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    if (savedDarkMode) {
        darkMode = true;
        document.body.classList.add('dark-mode');
        const button = document.querySelector('.dark-mode-toggle');
        button.textContent = '☀️';
        button.setAttribute('aria-label', 'Désactiver le mode sombre');
    }

    const savedPrefs = localStorage.getItem('weatherPrefs');
    if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        document.getElementById('cityInput').value = prefs.city || '';
        selectedDays = parseInt(prefs.days) || 3;
        document.getElementById('showLatitude').checked = prefs.showLatitude || false;
        document.getElementById('showLongitude').checked = prefs.showLongitude || false;
        document.getElementById('showRain').checked = prefs.showRain || false;
        document.getElementById('showWind').checked = prefs.showWind || false;
        document.getElementById('showWindDirection').checked = prefs.showWindDirection || false;
        updateDialSelector();
    }
}