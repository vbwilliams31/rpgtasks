// Wait until the HTML document is fully loaded and parsed
document.addEventListener('DOMContentLoaded', () => {

    // --- Constants ---
    const PROFILES_STORAGE_KEY = 'xpTrackerProfiles';
    const ACTIVE_PROFILE_STORAGE_KEY = 'xpTrackerActiveProfile';
    const RESET_FLAG_SESSION_KEY = 'justReset';

    // --- DOM Element References ---
    // Views
    const characterView = document.getElementById('character-view');
    const trackerView = document.getElementById('tracker-view');
    // Character Management
    const characterSelect = document.getElementById('character-select');
    const newCharacterNameInput = document.getElementById('new-character-name');
    const addCharacterButton = document.getElementById('add-character-button');
    const deleteCharacterButton = document.getElementById('delete-character-button');
    const loadCharacterButton = document.getElementById('load-character-button');
    // Core Tracker UI
    const levelDisplay = document.getElementById('level-display');
    const xpBar = document.getElementById('xp-bar');
    const xpText = document.getElementById('xp-text');
    const addQuestForm = document.getElementById('add-quest-form');
    const questNameInput = document.getElementById('quest-name');
    const questDifficultySelect = document.getElementById('quest-difficulty');
    const activeQuestsList = document.getElementById('active-quests-list');
    const completedQuestsLog = document.getElementById('completed-quests-log');
    const resetProgressButton = document.getElementById('reset-progress-button');
    const backToCharSelectButton = document.getElementById('back-to-char-select');
    // Notifications & Modals
    const levelUpNotification = document.getElementById('level-up-notification');
    const newJourneyNotification = document.getElementById('new-journey-notification');
    const resetConfirmModal = document.getElementById('reset-confirm-modal');
    const confirmResetButton = document.getElementById('confirm-reset-button');
    const cancelResetButton = document.getElementById('cancel-reset-button');
    const deleteConfirmModal = document.getElementById('delete-confirm-modal'); // Character delete
    const confirmDeleteButton = document.getElementById('confirm-delete-button');
    const cancelDeleteButton = document.getElementById('cancel-delete-button');
    const deleteQuestConfirmModal = document.getElementById('delete-quest-confirm-modal'); // Quest delete
    const confirmDeleteQuestButton = document.getElementById('confirm-delete-quest-button');
    const cancelDeleteQuestButton = document.getElementById('cancel-delete-quest-button');

    // --- Game State ---
    let currentProfileName = null;
    let level = 1;
    let currentXP = 0;
    let activeQuests = [];
    let completedQuests = [];
    let questIdToDelete = null; // Variable to store ID for quest deletion confirmation

    const difficultyMap = { '10': 'Easy', '25': 'Medium', '50': 'Hard' };

    // --- Initialization ---
    initializeCharacterView();
    checkShowNewJourneyMessage();

    // --- Event Listeners ---
    // Character View
    loadCharacterButton.addEventListener('click', handleLoadCharacter);
    addCharacterButton.addEventListener('click', handleAddCharacter);
    deleteCharacterButton.addEventListener('click', showDeleteConfirmation);
    confirmDeleteButton.addEventListener('click', executeDeleteCharacter);
    cancelDeleteButton.addEventListener('click', hideDeleteConfirmation);
    // Tracker View
    backToCharSelectButton.addEventListener('click', showCharacterView);
    addQuestForm.addEventListener('submit', handleAddQuest);
    resetProgressButton.addEventListener('click', showResetConfirmation);
    confirmResetButton.addEventListener('click', executeReset);
    cancelResetButton.addEventListener('click', hideResetConfirmation);
    // Quest Delete Modal
    confirmDeleteQuestButton.addEventListener('click', executeDeleteQuest);
    cancelDeleteQuestButton.addEventListener('click', hideDeleteQuestConfirmation);
    // Modal backdrop clicks
    resetConfirmModal.addEventListener('click', (e) => { if (e.target === resetConfirmModal) hideResetConfirmation(); });
    deleteConfirmModal.addEventListener('click', (e) => { if (e.target === deleteConfirmModal) hideDeleteConfirmation(); });
    deleteQuestConfirmModal.addEventListener('click', (e) => { if (e.target === deleteQuestConfirmModal) hideDeleteQuestConfirmation(); });


    // --- View Switching ---
    function showCharacterView() {
        console.log("[DEBUG] Function showCharacterView() called.");
        trackerView.classList.add('hidden');
        characterView.classList.remove('hidden');
        const profiles = loadAllProfiles();
        populateCharacterSelect(profiles);
        characterSelect.value = "";
        currentProfileName = null;
        localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
    }
    function showTrackerView() {
        console.log("[DEBUG] Function showTrackerView() called.");
        characterView.classList.add('hidden');
        trackerView.classList.remove('hidden');
    }

    // --- Core XP/Level/Quest Functions ---
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
        // Render active quests with edit/delete buttons
        currentActiveQuests.forEach(quest => activeQuestsList.appendChild(createQuestListItem(quest, false)));
        // Render completed quests (no edit/delete needed)
        [...currentCompletedQuests].reverse().forEach(quest => completedQuestsLog.appendChild(createQuestListItem(quest, true)));
    }

    /**
     * Creates list item for a quest, adding edit/delete buttons for active quests.
     */
    function createQuestListItem(quest, isCompleted) {
        const li = document.createElement('li');
        li.dataset.id = quest.id;

        // Container for name and difficulty (or edit input)
        const detailsDiv = document.createElement('div');
        detailsDiv.classList.add('quest-details');

        // Initial display elements
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('quest-name');
        nameSpan.textContent = quest.name;

        const difficultySpan = document.createElement('span');
        difficultySpan.classList.add('quest-difficulty');
        difficultySpan.textContent = `(${quest.difficultyText || difficultyMap[quest.difficulty.toString()]})`;

        detailsDiv.appendChild(nameSpan);
        detailsDiv.appendChild(difficultySpan);
        li.appendChild(detailsDiv);

        // Container for action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('quest-actions');

        if (isCompleted) {
            li.classList.add('completed-quest');
            // No actions for completed quests
        } else {
            // Active quest - add Edit, Delete, Complete buttons
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.classList.add('pixel-button', 'edit', 'small');
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                startEditQuest(quest.id, li, detailsDiv, actionsDiv);
            });

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.classList.add('pixel-button', 'danger', 'small');
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                showDeleteQuestConfirmation(quest.id); // Show confirmation modal
            });

            const completeButton = document.createElement('button');
            completeButton.textContent = 'Complete';
            completeButton.classList.add('pixel-button', 'complete', 'small'); // Added 'complete' class for potential specific styling
            completeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                completeQuest(quest.id, li);
            });

            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            actionsDiv.appendChild(completeButton);
            li.appendChild(actionsDiv);
        }

        return li;
    }

    /**
     * Replaces quest name with an input field for editing.
     */
    function startEditQuest(questId, li, detailsDiv, actionsDiv) {
        const quest = activeQuests.find(q => q.id === questId);
        if (!quest) return;

        // Clear existing details and actions
        detailsDiv.innerHTML = '';
        actionsDiv.innerHTML = ''; // Clear old buttons

        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = quest.name;
        input.classList.add('edit-quest-input');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission if inside one
                saveEditQuest(questId, li, input.value);
            } else if (e.key === 'Escape') {
                renderQuests(); // Cancel edit by re-rendering
            }
        });

        // Create Save button
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.classList.add('pixel-button', 'small'); // Use standard button style
        saveButton.addEventListener('click', (e) => {
            e.stopPropagation();
            saveEditQuest(questId, li, input.value);
        });

        // Create Cancel button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.classList.add('pixel-button', 'small', 'danger'); // Use danger style for cancel
        cancelButton.addEventListener('click', (e) => {
            e.stopPropagation();
            renderQuests(); // Re-render to cancel
        });

        detailsDiv.appendChild(input); // Add input to details area
        actionsDiv.appendChild(saveButton); // Add save/cancel to actions area
        actionsDiv.appendChild(cancelButton);

        input.focus(); // Focus the input field
        input.select(); // Select existing text
    }

    /**
     * Saves the edited quest name.
     */
    function saveEditQuest(questId, li, newName) {
        newName = newName.trim();
        if (!newName) {
            alert("Quest name cannot be empty!");
            // Optionally, could revert here instead of alert
            renderQuests(); // Re-render to reset
            return;
        }

        const questIndex = activeQuests.findIndex(q => q.id === questId);
        if (questIndex > -1) {
            activeQuests[questIndex].name = newName;
            saveCurrentCharacterData();
            renderQuests(); // Re-render the list to show the updated name and restore buttons
        } else {
            console.error("Quest not found during save edit:", questId);
            renderQuests(); // Re-render to be safe
        }
    }


    /**
     * Shows the confirmation modal for deleting a specific quest.
     */
    function showDeleteQuestConfirmation(questId) {
        questIdToDelete = questId; // Store the ID
        // Optional: Update modal text to include quest name?
        // const quest = activeQuests.find(q => q.id === questId);
        // if (quest) { deleteQuestConfirmModal.querySelector('p').textContent = `Delete quest "${quest.name}"?`; }
        deleteQuestConfirmModal.classList.remove('hidden');
    }

    /**
     * Hides the delete quest confirmation modal.
     */
    function hideDeleteQuestConfirmation() {
        deleteQuestConfirmModal.classList.add('hidden');
        questIdToDelete = null; // Clear the stored ID
    }

    /**
     * Deletes the quest identified by questIdToDelete.
     */
    function executeDeleteQuest() {
        if (questIdToDelete === null || !currentProfileName) {
            hideDeleteQuestConfirmation();
            return;
        }

        const questIndex = activeQuests.findIndex(q => q.id === questIdToDelete);
        if (questIndex > -1) {
            activeQuests.splice(questIndex, 1); // Remove quest from array
            saveCurrentCharacterData(); // Save the updated data
            renderQuests(); // Re-render the list
        } else {
            console.error("Quest to delete not found:", questIdToDelete);
        }
        hideDeleteQuestConfirmation(); // Hide modal and clear ID
    }


    function handleAddQuest(event) {
        event.preventDefault(); if (!currentProfileName) return;
        const questName = questNameInput.value.trim(); const difficultyValue = questDifficultySelect.value;
        if (!questName) { alert('Please enter a quest name!'); return; }
        const newQuest = { id: Date.now(), name: questName, difficulty: parseInt(difficultyValue), difficultyText: difficultyMap[difficultyValue], xp: parseInt(difficultyValue) };
        if (!Array.isArray(activeQuests)) activeQuests = [];
        activeQuests.push(newQuest); questNameInput.value = ''; questDifficultySelect.value = '10';
        saveCurrentCharacterData(); renderQuests();
    }
    function completeQuest(questId, listItemElement) {
        if (!currentProfileName) return; if (!Array.isArray(activeQuests)) activeQuests = [];
        const questIndex = activeQuests.findIndex(q => q.id === questId); if (questIndex === -1) return;
        const quest = activeQuests[questIndex]; addXP(quest.xp); activeQuests.splice(questIndex, 1);
        if (!Array.isArray(completedQuests)) completedQuests = [];
        completedQuests.push(quest); saveCurrentCharacterData();
        if (listItemElement) {
            listItemElement.classList.add('quest-complete-sparkle');
            setTimeout(() => { if (listItemElement && listItemElement.parentNode) { listItemElement.classList.remove('quest-complete-sparkle'); } renderQuests(); }, 600);
        } else { renderQuests(); }
    }
    function addXP(amount) { currentXP += amount; checkLevelUp(); }
    function checkLevelUp() {
        let xpNeeded = calculateXPForNextLevel(level); let leveledUp = false;
        while (currentXP >= xpNeeded && xpNeeded > 0) { level++; currentXP -= xpNeeded; leveledUp = true; xpNeeded = calculateXPForNextLevel(level); }
        if (leveledUp) { showLevelUpNotification(); updateLevelDisplay(); }
        updateXPBar();
    }
    function showLevelUpNotification() {
        levelUpNotification.classList.remove('hidden'); requestAnimationFrame(() => levelUpNotification.classList.add('show'));
        setTimeout(() => { levelUpNotification.classList.remove('show'); setTimeout(() => levelUpNotification.classList.add('hidden'), 300); }, 2500);
    }

    // --- Character Management ---
    function initializeCharacterView() { const profiles = loadAllProfiles(); populateCharacterSelect(profiles); showCharacterView(); }
    function handleLoadCharacter() {
         const selectedProfileName = characterSelect.value; if (!selectedProfileName) { alert("Please select a character."); return; }
         loadCharacterData(selectedProfileName); localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, selectedProfileName); updateTrackerUI(); showTrackerView();
     }
    function handleAddCharacter() {
        const newName = newCharacterNameInput.value.trim(); if (!newName) { alert("Please enter a name."); return; }
        const profiles = loadAllProfiles(); if (profiles[newName]) { alert(`Character "${newName}" exists!`); return; }
        profiles[newName] = createDefaultProfileData(); saveAllProfiles(profiles); newCharacterNameInput.value = '';
        populateCharacterSelect(profiles); characterSelect.value = newName; handleLoadCharacter(); showNewJourneyNotification();
    }
    function createDefaultProfileData() { return { level: 1, currentXP: 0, activeQuests: [], completedQuests: [] }; }
    function populateCharacterSelect(profiles) {
        const currentSelection = characterSelect.value; characterSelect.innerHTML = '';
        const placeholderOption = document.createElement('option'); placeholderOption.value = ""; placeholderOption.textContent = "-- Select Character --"; placeholderOption.disabled = false; placeholderOption.selected = true; characterSelect.appendChild(placeholderOption);
        let characterExists = false;
        for (const profileName in profiles) { characterExists = true; const option = document.createElement('option'); option.value = profileName; option.textContent = profileName; characterSelect.appendChild(option); }
        if (characterExists) { placeholderOption.disabled = true; }
        if (profiles[currentSelection]) { characterSelect.value = currentSelection; } else { placeholderOption.selected = true; }
    }
    function showDeleteConfirmation() {
        const selectedProfileName = characterSelect.value; if (!selectedProfileName) { alert("Please select character to delete."); return; }
        const profiles = loadAllProfiles(); if (Object.keys(profiles).length <= 1) { alert("Cannot delete last character!"); return; }
         const modalText = deleteConfirmModal.querySelector('p'); if (modalText) modalText.textContent = `Delete "${selectedProfileName}"? Cannot be undone!`;
        deleteConfirmModal.classList.remove('hidden');
    }
    function hideDeleteConfirmation() { deleteConfirmModal.classList.add('hidden'); }
    function executeDeleteCharacter() {
        const selectedProfileName = characterSelect.value; if (!selectedProfileName) { hideDeleteConfirmation(); alert("No character selected."); return; }
        const profiles = loadAllProfiles(); if (Object.keys(profiles).length <= 1) { hideDeleteConfirmation(); alert("Cannot delete last character!"); return; }
        if (profiles[selectedProfileName]) { delete profiles[selectedProfileName]; saveAllProfiles(profiles); hideDeleteConfirmation(); initializeCharacterView(); }
        else { hideDeleteConfirmation(); alert("Error: Could not find selected character."); }
    }

    // --- Reset Functions ---
    function showResetConfirmation() {
        if (!currentProfileName) return; const modalText = resetConfirmModal.querySelector('p');
        if (modalText) modalText.textContent = `Reset progress for "${currentProfileName}"? Cannot be undone!`;
        resetConfirmModal.classList.remove('hidden');
    }
    function hideResetConfirmation() { resetConfirmModal.classList.add('hidden'); }
    function executeReset() {
        if (!currentProfileName) { hideResetConfirmation(); return; } const profiles = loadAllProfiles();
        if (profiles[currentProfileName]) { profiles[currentProfileName] = createDefaultProfileData(); saveAllProfiles(profiles); sessionStorage.setItem(RESET_FLAG_SESSION_KEY, 'true'); hideResetConfirmation(); initializeCharacterView(); checkShowNewJourneyMessage(); }
        else { alert("Error: Could not find character data to reset."); hideResetConfirmation(); }
    }
    function checkShowNewJourneyMessage() { if (sessionStorage.getItem(RESET_FLAG_SESSION_KEY) === 'true') { sessionStorage.removeItem(RESET_FLAG_SESSION_KEY); showNewJourneyNotification(); } }
    function showNewJourneyNotification() {
         newJourneyNotification.classList.remove('hidden'); requestAnimationFrame(() => newJourneyNotification.classList.add('show'));
         setTimeout(() => { newJourneyNotification.classList.remove('show'); setTimeout(() => newJourneyNotification.classList.add('hidden'), 500); }, 3000);
    }

    // --- Local Storage Persistence ---
    function loadAllProfiles() {
        const savedProfiles = localStorage.getItem(PROFILES_STORAGE_KEY);
        try { const profiles = savedProfiles ? JSON.parse(savedProfiles) : {}; return typeof profiles === 'object' && profiles !== null ? profiles : {}; }
        catch (e) { console.error("Error parsing profiles from localStorage:", e); localStorage.removeItem(PROFILES_STORAGE_KEY); return {}; }
    }
    function saveAllProfiles(profiles) { localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles)); }
    function saveCurrentCharacterData() {
        if (!currentProfileName) { console.error("Attempted save with no active profile."); return; } const profiles = loadAllProfiles();
        if (!profiles[currentProfileName]) { profiles[currentProfileName] = createDefaultProfileData(); console.warn(`Profile ${currentProfileName} missing during save. Recreated.`); }
        profiles[currentProfileName] = { level: level, currentXP: currentXP, activeQuests: activeQuests || [], completedQuests: completedQuests || [] };
        saveAllProfiles(profiles);
    }
     function loadCharacterData(profileName) {
         const profiles = loadAllProfiles(); const profileData = profiles[profileName];
         if (profileData) { currentProfileName = profileName; level = profileData.level || 1; currentXP = profileData.currentXP || 0; activeQuests = profileData.activeQuests || []; completedQuests = profileData.completedQuests || []; }
         else { console.error(`Attempted load non-existent profile: ${profileName}`); showCharacterView(); }
     }
     function updateTrackerUI() { updateLevelDisplay(); updateXPBar(); renderQuests(); }

}); // End of DOMContentLoaded listener
