// Initialize Firebase (replace with your own config)
let groceryItems = [];
let itemSuggestions = new Set(); // For keeping unique items in memory

// DOM Elements
const itemText = document.getElementById('todoText');
const itemsDiv = document.querySelector(".todos");
const suggestionsList = document.createElement('ul');
suggestionsList.className = 'suggestions-list';
const searchSuggestionsList = document.createElement('ul');
searchSuggestionsList.className = 'suggestions-list';

const errorAudio = new Audio('./assets/audio/error.mp3');




// Default category for items not in the list
const defaultCategory = { color: '#f0f0f0', emoji: '🛒', type: 'Other' };

// Function to find the best matching category for an item
function findItemCategory(itemName) {
    itemName = itemName.toLowerCase();
    
    // First try exact match
    if (itemCategories[itemName]) {
        return itemCategories[itemName];
    }
    
    // Then try to find partial matches
    for (let category in itemCategories) {
        if (itemName.includes(category) || category.includes(itemName)) {
            return itemCategories[category];
        }
    }
    
    return defaultCategory;
}
// Function to load suggestions from Firebase
function loadSuggestions() {
    itemSuggestions.clear(); // Clear existing suggestions
    return db.collection('itemSuggestions')
        .orderBy('timestamp', 'desc')
        .get()
        .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                itemSuggestions.add(doc.data().name.toLowerCase());
            });
        })
        .catch((error) => {
            console.error("Error loading suggestions: ", error);
        });
}
// Function to add a new suggestion to Firebase
function addSuggestion(itemName) {
    const normalizedName = itemName.toLowerCase();
    if (!itemSuggestions.has(normalizedName)) {
        return db.collection('itemSuggestions').add({
            name: normalizedName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            itemSuggestions.add(normalizedName);
        })
        .catch((error) => {
            console.error("Error adding suggestion: ", error);
        });
    }
    return Promise.resolve();
}

// Load items from Firebase on page load
function loadGroceryItems() {
    db.collection('groceryItems').orderBy('timestamp', 'desc').get()
    .then((querySnapshot) => {
        groceryItems = [];
        querySnapshot.forEach((doc) => {
            let item = doc.data();
            item.id = doc.id;
            groceryItems.push(item);
        });
        generateGroceryItems();
    })
    .catch((error) => {
        console.error("Error loading grocery items: ", error);
    });
}

// Modified addGroceryItem function
function addGroceryItem(e) {
    e.preventDefault();
    const itemText = document.getElementById('todoText');
    const itemQuantity = document.getElementById('itemQuantity');
    const itemPrice = document.getElementById('itemPrice');
    const popup = document.getElementById('popup');
    const audio = new Audio('./assets/audio/complete.mp3');

    if (!itemText.value.trim()) {
        errorAudio.play();
        alert('Please enter an item name');
        return;
    }

    const itemName = itemText.value.trim().toLowerCase();
    
    // Check if the item already exists
   
    const itemExists = groceryItems.some(item => item.name.toLowerCase() === itemName);
    if (itemExists) {
        errorAudio.play();
        alert('This item is already in your grocery list.');
        return;
    }

    const quantity = itemQuantity.value ? parseInt(itemQuantity.value) : 0;
    const price = itemPrice.value ? parseFloat(itemPrice.value) : 0;
    const category = findItemCategory(itemName);
    
    const item = {
        name: itemName,
        status: false,
        color: category.color,
        emoji: category.emoji,
        type: category.type,
        quantity: quantity,
        price: price,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('groceryItems').add(item)
        .then((docRef) => {
            item.id = docRef.id;
            groceryItems.unshift(item);
            return addSuggestion(itemName);
        })
        .then(() => {
            itemText.value = '';
            itemQuantity.value = '';
            itemPrice.value = '';
            updateTotals();
            generateGroceryItems();
            populateCategoryOptions(); // Refresh category options
            suggestionsList.style.display = 'none';

            // Show popup with item emoji and name
            popup.innerHTML = `${item.emoji} ${item.name}`;
            popup.classList.add('show');
            audio.play();
            setTimeout(() => {
                popup.classList.remove('show');
            }, 2000);
        })
        .catch((error) => {
            console.error("Error adding grocery item: ", error);
        });
}

// Modified populateCategoryOptions function
function populateCategoryOptions() {
    const categorySelect = document.getElementById('categorySelect');
    categorySelect.innerHTML = '<option value="all">All Categories</option>';

    // Group items by type and sort categories by the newest item timestamp
    const groupedItems = groceryItems.reduce((groups, item) => {
        const type = item.type || 'Other';
        if (!groups[type]) {
            groups[type] = { newestTimestamp: item.timestamp };
        }
        if (item.timestamp > groups[type].newestTimestamp) {
            groups[type].newestTimestamp = item.timestamp;
        }
        return groups;
    }, {});

    // Sort categories by the newest item timestamp
    const sortedCategories = Object.keys(groupedItems).sort((a, b) => groupedItems[b].newestTimestamp - groupedItems[a].newestTimestamp);

    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

function setupRealTimeUpdates() {
    db.collection('groceryItems')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || 
                    change.type === 'modified' || 
                    change.type === 'removed') {
                    // Reload grocery items when any change occurs
                    loadGroceryItems();
                }
            });
        });
}

// Modified generateGroceryItems function
function generateGroceryItems(filteredItems = null) {
    const selectedCategory = document.getElementById('categorySelect').value;
    const items = filteredItems || groceryItems;
    itemsDiv.innerHTML = '';

    // Sort items by timestamp in descending order
    items.sort((a, b) => b.timestamp - a.timestamp);

    // Group items by type and sort categories by the newest item timestamp
    const groupedItems = items.reduce((groups, item) => {
        const type = item.type || 'Other';
        if (!groups[type]) {
            groups[type] = { items: [], total: 0, newestTimestamp: item.timestamp };
        }
        groups[type].items.push(item);
        groups[type].total += (item.price || 0) * (item.quantity || 1);
        if (item.timestamp > groups[type].newestTimestamp) {
            groups[type].newestTimestamp = item.timestamp;
        }
        return groups;
    }, {});

    // Sort categories by the newest item timestamp
    const sortedCategories = Object.keys(groupedItems).sort((a, b) => groupedItems[b].newestTimestamp - groupedItems[a].newestTimestamp);

    sortedCategories.forEach(category => {
        if (groupedItems[category] && groupedItems[category].items.length > 0) {
            if (selectedCategory === 'all' || selectedCategory === category) {
                itemsDiv.innerHTML += `
                    <div class="category-header">
                        <h2>${category} <span class="category-total">Total: ₹${groupedItems[category].total.toFixed(2)}</span></h2>
                    </div>
                `;
                groupedItems[category].items.forEach(item => {
                    const showQuantity = item.quantity && item.quantity > 0;
                    const showPrice = item.price && item.price > 0;
                    
                    let currentItem = `
                        <div class="todo" style="background-color: ${item.color}">
                            <form id="form${item.id}" class="editForm">
                                <div class='leftEditForm'>
                                    <div class="input-container">
                                        <span class="emoji">${item.emoji}</span>

                                        <label class="container">
                                        <input 
                                            id='checkbox${item.id}' 
                                            ${item.status ? 'checked' : ''} 
                                            onclick="checkHandler('${item.id}')" 
                                            type="checkbox"
                                        >
                                        <div class="checkmark"></div>
                                        </label>
                                        <input 
                                            class='editInput' 
                                            type="text" 
                                            ${item.status ? 'style="text-decoration: line-through"' : ''} 
                                            required 
                                            disabled 
                                            value="${item.name}" 
                                            id="input${item.id}"
                                        >
                                    </div>
                                    ${showQuantity || showPrice ? `
                                        <div class="item-details">
                                            ${showQuantity ? `<span class="quantity-display">Qty: ${item.quantity}</span>` : ''}
                                            ${showPrice ? `<span class="price-display">₹${item.price.toFixed(2)}</span>` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="editFormButtons">
                                    <button type="button" class="editButton edit" onclick="editItem('${item.id}')">
                                        <img src="assets/icons/edit.png" alt="Edit" id='editIcon${item.id}'>
                                    </button>
                                    <button type="button" class="editButton delete-cancel" onclick="deleteGroceryItem('${item.id}')">
                                        <img src="assets/icons/bin.png" alt="Delete">
                                    </button>
                                </div>
                            </form>
                        </div>`;
                    itemsDiv.innerHTML += currentItem;
                });
            }
        }
    });
    updateTotals();
}

// Function to update totals
function updateTotals() {
    totalItems = groceryItems.reduce((sum, item) => sum + 1, 0);
    totalPrice = groceryItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    
    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('totalPrice').textContent = totalPrice.toFixed(0);
}

// Modified editItem function
function editItem(itemId) {
    const item = groceryItems.find(item => item.id === itemId);
    if (!item) return;

    const inputElement = document.getElementById(`input${itemId}`);
    const isEditing = !inputElement.disabled;

    if (!isEditing) {
        // Enter edit mode
        const form = document.getElementById(`form${itemId}`);
        const currentQuantity = item.quantity || 1;
        const currentPrice = item.price || 0;

        const editForm = `
            <div class='leftEditForm'>
                <span class="emoji" style="display: none;">${item.emoji}</span>
                <input type="text" value="${item.name}" class="editInput" id="editName${itemId}">
                <input type="number" value="${currentQuantity}" min="1" class="quantity-input" id="editQuantity${itemId}">
                <input type="number" value="${currentPrice}" min="0" step="0.01" class="price-input" id="editPrice${itemId}">
            </div>
            <div class="editFormButtons">
                <button type="button" class="editButton complete" onclick="saveEdit('${itemId}')">
                    <img src="assets/icons/save.png" alt="Save">
                </button>
                <button type="button" class="editButton delete-cancel" onclick="cancelEdit('${itemId}')">
                    <img src="assets/icons/close.png" alt="Cancel">
                </button>
            </div>
        `;
        form.innerHTML = editForm;
    }
}
function cancelEdit(itemId){generateGroceryItems();}

// Function to save edits
function saveEdit(itemId) {
    const newName = document.getElementById(`editName${itemId}`).value;
    const newQuantity = parseInt(document.getElementById(`editQuantity${itemId}`).value) || 1;
    const newPrice = parseFloat(document.getElementById(`editPrice${itemId}`).value) || 0;

    if (!newName.trim()) {
        errorAudio.play();
        alert('Item name cannot be empty');
        return;
    }

    // Check if the item already exists
    const itemExists = groceryItems.some(item => item.name.toLowerCase() === newName.toLowerCase() && item.id !== itemId);
    if (itemExists) {
        errorAudio.play();
        alert('This item is already in your grocery list.');
        return;
    }

    const category = findItemCategory(newName.trim());

    db.collection('groceryItems').doc(itemId).update({
        name: newName.trim(),
        quantity: newQuantity,
        price: newPrice,
        color: category.color,
        emoji: category.emoji,
        type: category.type
    }).then(() => {
        const item = groceryItems.find(item => item.id === itemId);
        if (item) {
            item.name = newName.trim();
            item.quantity = newQuantity;
            item.price = newPrice;
            item.color = category.color;
            item.emoji = category.emoji;
            item.type = category.type;
            generateGroceryItems();
            populateCategoryOptions(); // Refresh category options
        }
    }).catch((error) => {
        console.error("Error updating item: ", error);
    });
}

// Update item name
function updateItemName(itemId, newName) {
    if (!newName.trim()) {
        errorAudio.play();
        alert('Item name cannot be empty');
        return;
    }

    if (itemExists) {
        errorAudio.play();
        alert('This item is already in your grocery list.');
        return;
    }

    const category = findItemCategory(newName.trim());

    db.collection('groceryItems').doc(itemId).update({
        name: newName.trim(),
        color: category.color,
        emoji: category.emoji,
        type: category.type
    }).then(() => {
        const item = groceryItems.find(item => item.id === itemId);
        if (item) {
            item.name = newName.trim();
            item.color = category.color;
            item.emoji = category.emoji;
            item.type = category.type;
            generateGroceryItems();
        }
    }).catch((error) => {
        console.error("Error updating item name: ", error);
    });
}

function cleanupOldItems() {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Promise array to handle all cleanup operations
    const cleanupPromises = [];

    // 1. Cleanup checked items older than 2 days
    const checkedItemsCleanup = db.collection('groceryItems')
        .where('status', '==', true)
        .where('checkedTimestamp', '<=', twoDaysAgo)
        .get()
        .then((querySnapshot) => {
            const batch = db.batch();
            querySnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            return batch.commit();
        });
    cleanupPromises.push(checkedItemsCleanup);

    // 2. Cleanup items older than 1 month from itemSuggestions
    const oldSuggestionsCleanup = db.collection('itemSuggestions')
        .where('timestamp', '<=', oneMonthAgo)
        .get()
        .then((querySnapshot) => {
            const batch = db.batch();
            querySnapshot.forEach((doc) => {
                batch.delete(doc.ref);
                // Remove from local Set as well
                itemSuggestions.delete(doc.data().name.toLowerCase());
            });
            return batch.commit();
        });
    cleanupPromises.push(oldSuggestionsCleanup);

    // 3. Cleanup items older than 1 month from groceryItems
    const oldItemsCleanup = db.collection('groceryItems')
        .where('timestamp', '<=', oneMonthAgo)
        .get()
        .then((querySnapshot) => {
            const batch = db.batch();
            querySnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            return batch.commit();
        });
    cleanupPromises.push(oldItemsCleanup);

    // Execute all cleanup operations
    Promise.all(cleanupPromises)
        .then(() => {
            // Refresh the local items list
            return loadGroceryItems();
        })
        .then(() => {
            // Reload suggestions after cleanup
            return loadSuggestions();
        })
        .catch((error) => {
            console.error("Error during cleanup operations: ", error);
        });
}

// Handle checkbox state
function checkHandler(itemId) {
    const item = groceryItems.find(item => item.id === itemId);
    if (!item) return;

    const newStatus = !item.status;
    const updateData = {
        status: newStatus
    };

    // Add checkedTimestamp when item is checked, remove it when unchecked
    if (newStatus) {
        updateData.checkedTimestamp = firebase.firestore.FieldValue.serverTimestamp();
    } else {
        updateData.checkedTimestamp = firebase.firestore.FieldValue.delete();
    }
    
    db.collection('groceryItems').doc(itemId).update(updateData)
        .then(() => {
            item.status = newStatus;
            if (newStatus) {
                item.checkedTimestamp = new Date();
            } else {
                delete item.checkedTimestamp;
            }
            const input = document.getElementById(`input${itemId}`);
            input.style.textDecoration = newStatus ? 'line-through' : 'none';
        })
        .catch((error) => {
            console.error("Error updating status: ", error);
        });
}


// Delete grocery item
function deleteGroceryItem(itemId) {
    db.collection('groceryItems').doc(itemId).delete()
        .then(() => {
            groceryItems = groceryItems.filter(item => item.id !== itemId);
            generateGroceryItems();
            populateCategoryOptions(); // Refresh category options
        })
        .catch((error) => {
            console.error("Error deleting item: ", error);
        });
}

// Toggle edit mode
function toggleEdit(itemId) {
    const input = document.getElementById(`input${itemId}`);
    const buttonImage = document.getElementById(`editIcon${itemId}`);
    const isInputDisabled = input.disabled;

    if (isInputDisabled) {
        input.disabled = false;
        input.style.borderBottom = '0.5px solid gray';
        buttonImage.src = 'assets/icons/save.png';
    } else {
        updateItemName(itemId, input.value);
        input.disabled = true;
        input.style.borderBottom = 'none';
        buttonImage.src = 'assets/icons/edit.png';
    }
}

// Update item name
function updateItemName(itemId, newName) {
    if (!newName.trim()) {
        errorAudio.play();
        alert('Item name cannot be empty');
        return;
    }

    const category = findItemCategory(newName.trim());

    db.collection('groceryItems').doc(itemId).update({
        name: newName.trim(),
        color: category.color,
        emoji: category.emoji
    }).then(() => {
        const item = groceryItems.find(item => item.id === itemId);
        if (item) {
            item.name = newName.trim();
            item.color = category.color;
            item.emoji = category.emoji;
            generateGroceryItems(); // Refresh to show new color and emoji
        }
    }).catch((error) => {
        console.error("Error updating item name: ", error);
    });
}

function showSuggestions(inputElement, suggestionListElement, isSearch = false) {
    const inputValue = inputElement.value.toLowerCase().trim();
    if (!inputValue) {
        suggestionListElement.style.display = 'none';
        return;
    }

    // Combine itemCategories with existing suggestions
    let suggestions = new Set([
        ...Array.from(itemSuggestions),
        ...Object.keys(itemCategories)
    ]);

    // Filter suggestions based on input
    const matchingSuggestions = Array.from(suggestions)
        .filter(item => item.toLowerCase().includes(inputValue))
        .slice(0, 3); // Limit to 5 suggestions

    if (matchingSuggestions.length === 0) {
        suggestionListElement.style.display = 'none';
        return;
    }

    // Clear previous suggestions
    suggestionListElement.innerHTML = '';

    // Add new suggestions with category information and emoji
    matchingSuggestions.forEach(suggestion => {
        const li = document.createElement('li');
        const category = itemCategories[suggestion.toLowerCase()] || defaultCategory;
        
        li.innerHTML = `
            <span class="suggestion-emoji">${category.emoji}</span>
            <span class="suggestion-text">${suggestion}</span>
            <span class="suggestion-category">${category.type}</span>
        `;

        li.addEventListener('click', () => {
            inputElement.value = suggestion;
            suggestionListElement.style.display = 'none';
            
            // If this is the search bar, trigger the search
            if (isSearch) {
                const event = new Event('input');
                inputElement.dispatchEvent(event);
            }
        });

        suggestionListElement.appendChild(li);
    });

    suggestionListElement.style.display = 'block';
}

// Add search functionality
function setupSearch() {
    const searchBar = document.getElementById('searchBar');
    if (searchBar) {
        // Wrap searchBar in a container for suggestions
        const searchContainer = document.createElement('div');
        searchContainer.className = 'suggestions-container';
        searchBar.parentNode.insertBefore(searchContainer, searchBar);
        searchContainer.appendChild(searchBar);
        searchContainer.appendChild(searchSuggestionsList);

        searchBar.addEventListener('input', () => {
            showSuggestions(searchBar, searchSuggestionsList, true);
            const searchText = searchBar.value.toLowerCase().trim();
            const filteredItems = groceryItems.filter(item => 
                item.name.toLowerCase().includes(searchText)
            );
            generateGroceryItems(filteredItems);
        });
    }
}

// Update the initialization code
document.addEventListener('DOMContentLoaded', () => {
    // Create containers for both input and search suggestions
    const inputContainer = document.createElement('div');
    inputContainer.className = 'suggestions-container';
    const itemText = document.getElementById('todoText');
    itemText.parentNode.insertBefore(inputContainer, itemText);
    inputContainer.appendChild(itemText);
    inputContainer.appendChild(suggestionsList);

    const searchContainer = document.createElement('div');
    searchContainer.className = 'suggestions-container';
    const searchBar = document.getElementById('searchBar');
    if (searchBar) {
        searchBar.parentNode.insertBefore(searchContainer, searchBar);
        searchContainer.appendChild(searchBar);
        searchContainer.appendChild(searchSuggestionsList);
    }

    // Add input event listeners
    itemText.addEventListener('input', () => {
        showSuggestions(itemText, suggestionsList);
    });

    if (searchBar) {
        searchBar.addEventListener('input', () => {
            showSuggestions(searchBar, searchSuggestionsList, true);
            const searchText = searchBar.value.toLowerCase().trim();
            const filteredItems = groceryItems.filter(item => 
                item.name.toLowerCase().includes(searchText)
            );
            generateGroceryItems(filteredItems);
        });
    }

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.suggestions-container')) {
            suggestionsList.style.display = 'none';
            searchSuggestionsList.style.display = 'none';
        }
    });

    // Initialize cleanup
    cleanupOldItems(); // Initial cleanup
    setInterval(cleanupOldItems, 3600000); // Run cleanup every hour

    // Load all data and initialize search
    Promise.all([loadGroceryItems(), loadSuggestions()])
    .then(() => {
        setupSearch();
        populateCategoryOptions();
        setupRealTimeUpdates(); // Add this line
        console.log('App initialized successfully');
    })
    .catch(error => {
        console.error('Error during app initialization:', error);
    });

    // Populate category options
    populateCategoryOptions();

    // Add event listener for category selection
    document.getElementById('categorySelect').addEventListener('change', () => {
        generateGroceryItems();
    });
});