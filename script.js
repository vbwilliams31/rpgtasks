// Wait until the HTML document is fully loaded and parsed
document.addEventListener('DOMContentLoaded', () => {

    // --- Constants for Local/Session Storage ---
    const PROFILES_STORAGE_KEY = 'xpTrackerProfiles'; // Stores all character data
    const ACTIVE_PROFILE_STORAGE_KEY = 'xpTrackerActiveProfile'; // Stores the name of the currently active character (when tracker is visible)
    const RESET_FLAG_SESSION_KEY = 'justReset'; // Flag in sessionStorage to show message after reset

    // --- Get References to DOM Elements ---
    // Views
    const characterView = document.getElementById('character-view');
    const trackerView = document.getElementById('tracker-view');

    // Character Management (in Character View)
    const characterSelect = document.getElementById('character-select');
    const newCharacterNameInput = document.getElementById('new-character-name');
    const addCharacterButton = document.getElementById('add-character-button');
    const deleteCharacterButton = document.getElementById('delete-character-button');
    const loadCharacterButton = document.getElementById('load-character-button');

    // Core Tracker UI (in Tracker View)
    const levelDisplay = document.getElementById('level-display');
    const xpBar = document.getElementById('xp-bar');
    const xpText = document.getElementById('xp-text');
    const addQuestForm = document.getElementById('add-quest-form');
    const questNameInput = document.getElementById('quest-name');
    const questDifficultySelect = document.getElementById('quest-difficulty');
    const activeQuestsList = document.getElementById('active-quests-list');
    const completedQuestsLog = document.getElementById('completed-quests-log');
    const resetProgressButton = document.getElementById('reset-progress-button');
    const backToCharSelectButton = document.getElementById('back-to-char-select'); // Get the button element

    // Notifications & Modals
    const levelUpNotification = document.getElementById('level-up-notification');
    const newJourneyNotification = document.getElementById('new-journey-notification');
    const resetConfirmModal = document.getElementById('reset-confirm-modal');
    const confirmResetButton = document.getElementById('confirm-reset-button');
    const cancelResetButton = document.getElementById('cancel-reset-button');
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const confirmDeleteButton = document.getElementById('confirm-delete-button');
    const cancelDeleteButton = document.getElementById('cancel-delete-button');


    // --- Game State Variables (for the currently loaded character in Tracker View) ---
    let currentProfileName = null; // Name of the character loaded into the tracker view
    let level = 1;
    let currentXP = 0;
    let activeQuests = [];
    let completedQuests = [];

    // Map difficulty XP values to their text representation
    const difficultyMap = {
        '10': 'Easy',
        '25': 'Medium',
        '50': 'Hard'
    };

    // --- Initialization ---
    initializeCharacterView(); // Populate dropdown, show character view initially
    checkShowNewJourneyMessage(); // Check if we need to show the post-reset message

    // --- Event Listeners ---
    // Character View Controls
    loadCharacterButton.addEventListener('click', handleLoadCharacter);
    addCharacterButton.addEventListener('click', handleAddCharacter);
    deleteCharacterButton.addEventListener('click', showDeleteConfirmation);
    confirmDeleteButton.addEventListener('click', executeDeleteCharacter);
    cancelDeleteButton.addEventListener('click', hideDeleteConfirmation);

    // Tracker View Controls
    // *** Check if the button exists before adding listener ***
    if (backToCharSelectButton) {
        console.log("Back button found, attaching listener."); // Debug log
        backToCharSelectButton.addEventListener('click', () => {
             console.log("Back button clicked!"); // Debug log inside listener
             showCharacterView();
        });
    } else {
        console.error("Error: Back to Character Select button not found!"); // Error if button missing
    }

    addQuestForm.addEventListener('submit', handleAddQuest);
    resetProgressButton.addEventListener('click', showResetConfirmation);
    confirmResetButton.addEventListener('click', executeReset);
    cancelResetButton.addEventListener('click', hideResetConfirmation);

    // Close modals on backdrop click
    resetConfirmModal.addEventListener('click', (event) => {
        if (event.target === resetConfirmModal) hideResetConfirmation();
    });
    deleteConfirmModal.addEventListener('click', (event) => {
        if (event.target === deleteConfirmModal) hideDeleteConfirmation();
    });

    // --- View Switching Functions ---

    /**
     * Shows the Character Selection view and hides the Tracker view.
     * Resets the dropdown and clears active profile state.
     */
    function showCharacterView() {
        console.log("Switching to Character View function called"); // Debug log
        trackerView.classList.add('hidden');
        characterView.classList.remove('hidden');
        // Repopulate to ensure it's up-to-date after potential deletes/resets
        const profiles = loadAllProfiles();
        populateCharacterSelect(profiles);
        characterSelect.value = ""; // Reset dropdown selection
        currentProfileName = null; // Clear the currently loaded profile name
        localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY); // Clear active profile from storage
    }

    /**
     * Shows the Tracker view and hides the Character Selection view.
     */
    function showTrackerView() {
        console.log("Switching to Tracker View"); // Debug log
        characterView.classList.add('hidden');
        trackerView.classList.remove('hidden');
    }

    // --- Core XP/Level/Quest Functions (Operate on loaded character state) ---

    function calculateXPForNextLevel(lvl) { return lvl * 100; }
    function updateLevelDisplay() { levelDisplay.textContent = `Level ${level}`; }

    function updateXPBar() {
        const xpNeeded = calculateXPForNextLevel(level);
        const percentage = xpNeeded > 0 ? Math.min(100, (currentXP / xpNeeded) * 100) : 0;
        xpBar.style.width = `${percentage}%`;
        xpText.textContent = `${currentXP} / ${xpNeeded} XP`;
    }

    function renderQuests() {
        activeQuestsList.innerHTML = '';
        completedQuestsLog.innerHTML = '';
        const currentActiveQuests = Array.isArray(activeQuests) ? activeQuests : [];
        const currentCompletedQuests = Array.isArray(completedQuests) ? completedQuests : [];
        currentActiveQuests.forEach(quest => activeQuestsList.appendChild(createQuestListItem(quest, false)));
        [...currentCompletedQuests].reverse().forEach(quest => completedQuestsLog.appendChild(createQuestListItem(quest, true)));
    }

    function createQuestListItem(quest, isCompleted) {
        const li = document.createElement('li');
        li.dataset.id = quest.id;
        const detailsDiv = document.createElement('div');
        detailsDiv.classList.add('quest-details');
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('quest-name');
        nameSpan.textContent = quest.name;
        const difficultySpan = document.createElement('span');
        difficultySpan.classList.add('quest-difficulty');
        difficultySpan.textContent = `(${quest.difficultyText || difficultyMap[quest.difficulty.toString()]})`;
        detailsDiv.appendChild(nameSpan);
        detailsDiv.appendChild(difficultySpan);
        li.appendChild(detailsDiv);
        if (isCompleted) {
            li.classList.add('completed-quest');
        } else {
            const completeButton = document.createElement('button');
            completeButton.textContent = 'Complete';
            completeButton.classList.add('pixel-button');
            completeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                completeQuest(quest.id, li);
            });
            li.appendChild(completeButton);
        }
        return li;
    }

    function handleAddQuest(event) {
        event.preventDefault();
        if (!currentProfileName) return;
        const questName = questNameInput.value.trim();
        const difficultyValue = questDifficultySelect.value;
        if (!questName) { alert('Please enter a quest name!'); return; }
        const newQuest = {
            id: Date.now(), name: questName, difficulty: parseInt(difficultyValue),
            difficultyText: difficultyMap[difficultyValue], xp: parseInt(difficultyValue)
        };
        if (!Array.isArray(activeQuests)) activeQuests = [];
        activeQuests.push(newQuest);
        questNameInput.value = '';
        questDifficultySelect.value = '10';
        saveCurrentCharacterData();
        renderQuests();
    }

    function completeQuest(questId, listItemElement) {
        if (!currentProfileName) return;
        if (!Array.isArray(activeQuests)) activeQuests = [];
        const questIndex = activeQuests.findIndex(q => q.id === questId);
        if (questIndex === -1) return;
        const quest = activeQuests[questIndex];
        addXP(quest.xp);
        activeQuests.splice(questIndex, 1);
        if (!Array.isArray(completedQuests)) completedQuests = [];
        completedQuests.push(quest);
        saveCurrentCharacterData();
        if (listItemElement) {
            listItemElement.classList.add('quest-complete-sparkle');
            setTimeout(() => {
                if (listItemElement && listItemElement.parentNode) {
                    listItemElement.classList.remove('quest-complete-sparkle');
                }
                renderQuests();
            }, 600);
        } else {
            renderQuests();
        }
    }

    function addXP(amount) {
        currentXP += amount;
        checkLevelUp();
    }

    function checkLevelUp() {
        let xpNeeded = calculateXPForNextLevel(level);
        let leveledUp = false;
        while (currentXP >= xpNeeded && xpNeeded > 0) {
            level++; currentXP -= xpNeeded; leveledUp = true;
            xpNeeded = calculateXPForNextLevel(level);
        }
        if (leveledUp) { showLevelUpNotification(); updateLevelDisplay(); }
        updateXPBar();
    }

    function showLevelUpNotification() {
        levelUpNotification.classList.remove('hidden');
        requestAnimationFrame(() => levelUpNotification.classList.add('show'));
        setTimeout(() => {
            levelUpNotification.classList.remove('show');
            setTimeout(() => levelUpNotification.classList.add('hidden'), 300);
        }, 2500);
    }

    // --- Character Management Functions ---

    function initializeCharacterView() {
        const profiles = loadAllProfiles();
        populateCharacterSelect(profiles);
        showCharacterView();
    }

    function handleLoadCharacter() {
         const selectedProfileName = characterSelect.value;
         if (!selectedProfileName) {
             alert("Please select a character to load.");
             return;
         }
         loadCharacterData(selectedProfileName);
         localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, selectedProfileName);
         updateTrackerUI();
         showTrackerView();
     }

    function handleAddCharacter() {
        const newName = newCharacterNameInput.value.trim();
        if (!newName) { alert("Please enter a name for the new character."); return; }
        const profiles = loadAllProfiles();
        if (profiles[newName]) { alert(`A character named "${newName}" already exists!`); return; }
        profiles[newName] = createDefaultProfileData();
        saveAllProfiles(profiles);
        newCharacterNameInput.value = '';
        populateCharacterSelect(profiles);
        characterSelect.value = newName;
        handleLoadCharacter();
        showNewJourneyNotification();
    }

    function createDefaultProfileData() { return { level: 1, currentXP: 0, activeQuests: [], completedQuests: [] }; }

    function populateCharacterSelect(profiles) {
        const currentSelection = characterSelect.value;
        characterSelect.innerHTML = '';
        const placeholderOption = document.createElement('option');
        placeholderOption.value = "";
        placeholderOption.textContent = "-- Select Character --";
        placeholderOption.disabled = false;
        placeholderOption.selected = true;
        characterSelect.appendChild(placeholderOption);

        let characterExists = false;
        for (const profileName in profiles) {
            characterExists = true;
            const option = document.createElement('option');
            option.value = profileName;
            option.textContent = profileName;
            characterSelect.appendChild(option);
        }

        if (characterExists) {
            placeholderOption.disabled = true;
        }
        if (profiles[currentSelection]) {
             characterSelect.value = currentSelection;
        } else {
             placeholderOption.selected = true;
        }
    }

    // Redundant function removed for clarity
    // function addProfileToSelect(profileName, isSelected = false) { ... }

    function showDeleteConfirmation() {
        const selectedProfileName = characterSelect.value;
        if (!selectedProfileName) { alert("Please select a character to delete."); return; }
        const profiles = loadAllProfiles();
        if (Object.keys(profiles).length <= 1) { alert("Cannot delete the last character!"); return; }
         const modalText = deleteConfirmModal.querySelector('p');
         if (modalText) modalText.textContent = `Are you sure you want to delete the character "${selectedProfileName}"? This cannot be undone!`;
        deleteConfirmModal.classList.remove('hidden');
    }

    function hideDeleteConfirmation() { deleteConfirmModal.classList.add('hidden'); }

    function executeDeleteCharacter() {
        const selectedProfileName = characterSelect.value;
        if (!selectedProfileName) { hideDeleteConfirmation(); alert("No character selected."); return; }
        const profiles = loadAllProfiles();
        if (Object.keys(profiles).length <= 1) { hideDeleteConfirmation(); alert("Cannot delete the last character!"); return; }
        if (profiles[selectedProfileName]) {
            delete profiles[selectedProfileName];
            saveAllProfiles(profiles);
            hideDeleteConfirmation();
            initializeCharacterView();
        } else {
            hideDeleteConfirmation();
            alert("Error: Could not find selected character to delete.");
        }
    }

    // --- Reset Functions (Operate on the character loaded in Tracker View) ---

    function showResetConfirmation() {
        if (!currentProfileName) return;
         const modalText = resetConfirmModal.querySelector('p');
         if (modalText) modalText.textContent = `Are you sure you want to reset progress for "${currentProfileName}"? This cannot be undone!`;
        resetConfirmModal.classList.remove('hidden');
    }

    function hideResetConfirmation() { resetConfirmModal.classList.add('hidden'); }

    function executeReset() {
        if (!currentProfileName) { hideResetConfirmation(); return; }
        const profiles = loadAllProfiles();
        if (profiles[currentProfileName]) {
            profiles[currentProfileName] = createDefaultProfileData();
            saveAllProfiles(profiles);
            sessionStorage.setItem(RESET_FLAG_SESSION_KEY, 'true');
            hideResetConfirmation();
            initializeCharacterView();
            checkShowNewJourneyMessage();
        } else {
            alert("Error: Could not find current character data to reset.");
            hideResetConfirmation();
        }
    }

    function checkShowNewJourneyMessage() {
        if (sessionStorage.getItem(RESET_FLAG_SESSION_KEY) === 'true') {
            sessionStorage.removeItem(RESET_FLAG_SESSION_KEY);
            showNewJourneyNotification();
        }
    }

    function showNewJourneyNotification() {
         newJourneyNotification.classList.remove('hidden');
         requestAnimationFrame(() => newJourneyNotification.classList.add('show'));
         setTimeout(() => {
             newJourneyNotification.classList.remove('show');
             setTimeout(() => newJourneyNotification.classList.add('hidden'), 500);
         }, 3000);
    }

    // --- Local Storage Persistence ---

    function loadAllProfiles() {
        const savedProfiles = localStorage.getItem(PROFILES_STORAGE_KEY);
        try {
            const profiles = savedProfiles ? JSON.parse(savedProfiles) : {};
            return typeof profiles === 'object' && profiles !== null ? profiles : {};
        } catch (e) {
            console.error("Error parsing profiles from localStorage:", e);
            localStorage.removeItem(PROFILES_STORAGE_KEY);
            return {};
        }
    }


    function saveAllProfiles(profiles) {
        localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    }

    function saveCurrentCharacterData() {
        if (!currentProfileName) { console.error("Attempted to save data with no active profile."); return; }
        const profiles = loadAllProfiles();
        if (!profiles[currentProfileName]) {
            profiles[currentProfileName] = createDefaultProfileData();
            console.warn(`Profile ${currentProfileName} was missing during save. Recreated.`);
        }
        profiles[currentProfileName] = {
            level: level, currentXP: currentXP,
            activeQuests: activeQuests || [], completedQuests: completedQuests || []
        };
        saveAllProfiles(profiles);
    }

     function loadCharacterData(profileName) {
         const profiles = loadAllProfiles();
         const profileData = profiles[profileName];
         if (profileData) {
             currentProfileName = profileName;
             level = profileData.level || 1;
             currentXP = profileData.currentXP || 0;
             activeQuests = profileData.activeQuests || [];
             completedQuests = profileData.completedQuests || [];
         } else {
             console.error(`Attempted to load non-existent profile: ${profileName}`);
             showCharacterView();
         }
     }

     function updateTrackerUI() {
         updateLevelDisplay();
         updateXPBar();
         renderQuests();
     }

}); // End of DOMContentLoaded listener
