(function () {
	const INPUT_TYPES = {
		NUMERIC: 'numeric'
	};
	
	class Input {
		/**
		 * create new generic input
		 * @param {INPUT_TYPES} type enum value from input types set
		 * @param {Number} numFields number of entry fields (e.g. for 4-digit combination, number is 4)
		 * @param {String} instructions instructions for field entry
		 */
		constructor(type, numFields, instructions) {
			//psuedo-abstract class
			if (this.constructor === Input) {
				throw new TypeError("Input may not be directly instantiated");
			}
			
			this.type = type;
			this.numFields = numFields;
			this.instructions = instructions;
		}
	}
	
	class NumericInput extends Input {
		/**
		 * create new numeric input set
		 * @param {Number} numFields number of entry fields
		 * @param {Number} min minimum number permitted in each field
		 * @param {Number} max maxmimum number permitted in each field (-1 = no limit)
		 */
		constructor(numFields = 1, min = 1, max = -1) {
			let instructions = "Enter a number";
			if (max > 0) {
				instructions += " between " + min + " and " + max + " (inclusive)";
			}
			if (numFields > 1) instructions += " in each field. No field may be left blank.";
			
			super(INPUT_TYPES.NUMERIC, numFields, instructions);
			this.min = min;
			this.max = max;
		}
	}
	
	class Card {
		/**
		 * create new card, track relevant info
		 * @param {Number} id id number of card (printed in card corner)
		 * @param {Input} input field input object
		 * @param {object} expectedValues array of correct entry/ies into field
		 * @param {String} success message to display on success
		 * @param {String} failure message to display on failure
		 * @param {object} collectItems array of items to collect on success
		 */
		constructor (id, input, expectedValues, success, failure, collectItems) {
			this.id = id;
			this.input = input;
			if (!Array.isArray(expectedValues) || expectedValues.length != input.numFields) {
				throw new TypeError("Expected values must be an array of correct values. Number of items must match number of fields in input");
			}
			if (!Array.isArray(collectItems)) {
				throw new TypeError("Items to collect must be an array of card and/or envelope IDs");
			}
			this.expectedValues = expectedValues;
			this.success = success;
			this.failure = failure;
			this.collectItems = collectItems;
		}
	}
	
	class CardSet extends Map {
		/**
		 * and add a new card to the set
		 * @param {Card} card card to add to set
		 */
		addCard(card) {
			let id = card.id;
			if (this.has(id)) {
				throw new ReferenceError("Attempting to reassign existing card id");
			} else {
				this.set(id, card);
			}
		}
	}
	
	/**
	 * incorrect entry in field
	 * @param {String} message message to display
	 */
	function failedEntry(message) {
		//TODO: replace alert with floating div
		alert(message + ". You have lost one minute.");
		
		//TODO: subtract from timer
	}
	
	//listen for card entries
	document.addEventListener("DOMContentLoaded", function () {
		let actionFlowContainer = document.getElementById("actionflowcontainer"),
			cardEntryContainer = document.getElementById("cardentrycontainer"),
			cardEntryForm = document.getElementById("cardentryform"),
			puzzleEntryContainer = document.getElementById("puzzleentrycontainer"),
			puzzleEntryForm = document.getElementById("puzzleentryform"),
			cardId = document.getElementById("cardid"),
			inputInstructions = document.getElementById("inputinstructions"),
			cardFields = document.getElementById("cardfields");
			
		//enter card number to view puzzle entry field
		cardEntryForm.addEventListener("submit", function (event) {
			event.preventDefault();
			let id = parseInt(this.elements.cardnumber.value);
			if (cards.has(id)) {
				let card = cards.get(id),
					input = card.input;
				puzzleEntryContainer.classList.add("active");
				cardId.textContent = id;
				cardFields.innerHTML = "";
				inputInstructions.textContent = input.instructions;
				puzzleEntryForm.dataset.currentCard = id;
				
				switch(input.type) {
					case INPUT_TYPES.NUMERIC :
						for (let i = 0; i < input.numFields; i++) {
							let field = document.createElement("input");
							field.type = "number";
							field.name = field.id = "puzzlefield" + i;
							field.min = input.min;
							if (input.max > 0) field.max = input.max;
							if (input.numFields > 1) {
								let label = document.createElement("label");
								label.htmlFor = field.id;
								label.textContent = String.fromCharCode(65 + i); //ASCII code for capital letters starts at 65
								cardFields.appendChild(label);
							}
							cardFields.appendChild(field);
						}
						break;
				}
			} else {
				//TODO: replace alert with a floating div
				alert("Please enter a valid card number");
			}
			
		}, false);
		
		//submit puzzle form
		puzzleEntryForm.addEventListener("submit", function (event) {
			event.preventDefault();
			let id = parseInt(this.dataset.currentCard),
				card = cards.get(id),
				numFields = card.input.numFields;
				
			for (let i = 0; i < numFields; i++) {
				let value = this.elements["puzzlefield" + i].value;
				//make sure they entered something in the field
				if (value == "") {
					//TODO: replace alert with floating div
					let message = "Enter a value";
					if (numFields > 1) message += " in each field";
					message += " before clicking submit";
					alert(message);
					return;
				} else if (value != card.expectedValues[i]) {
					failedEntry(card.failure);
					success = false;
					this.reset(); //remove this line if we don't want to clear inputs on failure
					return;
				}
			}
			
			//if we made it to the end with no failure, then give success message
			let message = card.success + ". Collect the following items:";
			card.collectItems.forEach(function (item) {
				message += (isNaN(item) && !item.match(/^L[A-Z]$/) ? " Envelope " : " Card ") + item + ',';
			});
			message = message.slice(0, -1); //remove trailing comma
			//TODO: replace alert with floating div (or maybe desktop notification)
			alert(message);
			
			//reset form for next card
			puzzleEntryContainer.classList.remove("active");
			cardFields.innerHTML = "";
			cardEntryForm.reset();
		}, false);
	}, false);
	
	//set of card => field mappings
	let cards = new CardSet();
	
	//Tomahna
	cards.addCard(new Card(19,
		new NumericInput(),
		[7],
		"The drawer opens to reveal a note and another strange 3D object",
		"The key does not seem to fit here",
		[26, 'B']
	));
	cards.addCard(new Card(21,
		new NumericInput(4, 0, 9),
		[0, 2, 4, 0],
		"An image appears on the control panel's screen",
		"Nothing happens",
		[37]
	));
	cards.addCard(new Card(18,
		new NumericInput(4, 1, 12),
		[1, 4, 5, 11],
		"You open the case to reveal even more 3D objects",
		"You fail to open the case",
		['C']
	));
	cards.addCard(new Card(16,
		new NumericInput(),
		[46],
		"You open the locked box to find a linking book",
		"The box doesn't open",
		['LK']
	));
	
	//Kadish Tolesa
	/*
	cards.addCard(new Card(5,
		//new ImageInput
		[3], //gehn's cannen
		"You notice the image resembles Gehn's cannen",
		"Nothing happens",
		[17, 'E']
	));
	*/
	cards.addCard(new Card(17,
		new NumericInput(),
		[20],
		"After successfully assembling the tiles, a panel opens on the far side and you find a linking book and another 3D object",
		"Nothing happens",
		['LC', 'F']
	));
	
	//Channelwood
	card.addCard(new Card(31,
		new NumericInput(1, 1, 8),
		[7],
		"You open the drawer to find a familiar-looking symbol",
		"The drawer doesn't open",
		[29]
	));
	/*
	cards.addCard(new Card(8,
		new ImageInput
		[4], //chasm
		"You see a message from Sirrus to Achenar. While much of it is rather cryptic, he reminds his brother where to find the linking book he hid",
		"You see a nonsensical message from Achenar",
		['LR', 'G']
	));
	*/
	
	//Riven
	cards.addCard(new Card(3,
		new NumericInput(3, 1, 9),
		[1, 6, 4],
		"Inside the drawer you find yet another 3D animal. You also hear the control panel on the incinerator come to life.",
		"The drawer doesn't open",
		['H']
	));
	/*
	cards.addCard(new Card(39,
		new ImageInput
		[3, 12, 16, 20], //bat, elephant, mole, whark
		"The incinerator door opens. Fortunately the linking book inside is unburned",
		"The door doesn't open",
		['LA'] //need to collect LS on time out
	));
	*/
})();