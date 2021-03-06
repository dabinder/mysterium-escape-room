(function () {
	const INPUT_TYPES = {
		NUMERIC: 'numeric',
		IMAGE: 'image'
	};

	//indicate prerequisites for accessing a particular card (e.g. card 3 must be completed before card 39)
	const DEPENDENCIES = {
		8: {
			message: "The imager appears to be locked",
			cards: [31]
		},
		39: {
			message: "The incinerator doesn't seem to be powered",
			cards: [3]
		}
	};
	
	//first card(s) to collect
	const START_CARDS = ['LT']

	//final card provides alternate ending card after running out of time
	const FINAL_CARD = {
		id: 39,
		timeout: 'LS',
		success: 'LA'
	}

	var submittedCards = [],
		countdown;

	//maximum time permitted (minutes)
	const MAX_TIME = 45;
	var baseTime = MAX_TIME,
		timedOut = false;
		
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

	class ImageInput extends Input {
		/**
		 * create new image input set
		 * @param {Number} numFields number of dropdown fields
		 * @param {String} folderName name of image folder containing entries for this input 
		 * @param {Number} numImages number of image entries for this field
		 */
		constructor(numFields, folderName, numImages) {
			let instructions = "Click ";
			instructions += (numFields > 1) ?
				"each" :
				"the";
			instructions += " box to select an image";

			super(INPUT_TYPES.IMAGE, numFields, instructions);
			this.folderName = folderName;
			this.numImages = numImages;
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
		 * @param {object} discardItems array of items to discard on success (cards no longer used after this point)
		 */
		constructor(id, input, expectedValues, success, failure, collectItems, discardItems) {
			this.id = id;
			this.input = input;
			if (!Array.isArray(expectedValues) || (expectedValues.length > 0 && expectedValues.length != input.numFields)) {
				throw new TypeError("Expected values must be an array of correct values. Number of items must match number of fields in input");
			}
			if (!Array.isArray(collectItems)) {
				throw new TypeError("Items to collect must be an array of card and/or envelope IDs");
			}
			this.expectedValues = expectedValues;
			this.success = success;
			this.failure = failure;
			this.collectItems = collectItems;
			this.discardItems = discardItems;
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
		popupMessage(message + " You have lost one minute.", true);
		baseTime--;
		setStorage("basetime", baseTime);
	}
	
	/**
	 * popup notification in corner of screen
	 * @param {String} message message to display
	 * @param {boolean} autoDismiss automatically dismiss message
	 */
	function popupMessage(message, autoDismiss) {
		let noticeArea = document.createElement("div");
		noticeArea.className = "popupnotice off";
		let div = document.createElement("div");
		div.textContent = message;
		let midDiv = document.createElement("div");
		midDiv.appendChild(div);
		midDiv.className = "popupcontent";
		noticeArea.appendChild(midDiv);
		document.body.appendChild(noticeArea);
		var x = noticeArea.clientHeight; //hack to get this to work in FF
		noticeArea.className = "popupnotice";

		if (autoDismiss) {
			//fade after 5 seconds
			setTimeout(function () {
				noticeArea.className = "popupnotice fade";
			}, 5 * 1000);
			//remove after 6 seconds
			setTimeout(function () {
				noticeArea.parentNode.removeChild(noticeArea);
			}, 6 * 1000);
		} else {
			let close = document.createElement("div");
			close.className = "close";
			noticeArea.appendChild(close);
			close.addEventListener("click", function (click) {
				noticeArea.parentNode.removeChild(noticeArea);
			}, false);
		}
	}
	
	//listen for card entries
	document.addEventListener("DOMContentLoaded", function () {
		//pre-fill timer
		document.getElementById("timer").textContent = baseTime + ":00";
		
		//check for resuming previous game
		let startTime = getStorage("startTime");
		
		if (startTime != null &&
			(Date.now() - startTime) / 1000 < baseTime * 60 &&
			confirm("A previous session was found. Do you wish to continue where you left off?")
		) {
			baseTime = getStorage("basetime");
			startGame();
			startTimer(startTime);
			let storedCards = getStorage("submittedCards");
			if (storedCards != null) {
				submittedCards = storedCards.split(",").map(s => parseInt(s));
			}
		} else {
			let startButton = document.getElementById("startbutton");
			
			//start game
			startButton.addEventListener("click", function(event) {
				event.preventDefault();
				let message = "Collect " +
					(START_CARDS.length > 1 ? "cards" : "card") +
					" " +
					START_CARDS.join(", ");
				popupMessage(message);
				startGame();
				startTimer();			
			}, false);
		}
		
		let cardEntryForm = document.getElementById("cardentryform"),
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
				//check for required sequence when applicable
				if (DEPENDENCIES.hasOwnProperty(id)) {
					let dependency = DEPENDENCIES[id];
					for (let i = 0; i < dependency.cards.length; i++) {
						let dependentCard = dependency.cards[i];
						if (!submittedCards.includes(dependentCard)) {
							popupMessage(dependency.message, true);
							return;
						}
					}
				}

				let card = cards.get(id),
					input = card.input;
				puzzleEntryContainer.classList.add("active");
				cardId.textContent = id;
				cardFields.innerHTML = "";
				inputInstructions.textContent = input.instructions;
				puzzleEntryForm.dataset.currentCard = id;

				switch (input.type) {
					case INPUT_TYPES.NUMERIC:
						for (let i = 0; i < input.numFields; i++) {
							let field = document.createElement("input"),
								fieldContainer = document.createElement("span");
							field.type = "number";
							field.name = field.id = "puzzlefield" + i;
							field.min = input.min;
							fieldContainer.className = "puzzlefield";
							if (input.max > 0) field.max = input.max;
							if (input.numFields > 1) {
								let label = document.createElement("label");
								label.htmlFor = field.id;
								label.textContent = String.fromCharCode(65 + i); //ASCII code for capital letters starts at 65
								fieldContainer.appendChild(label);
							}
							fieldContainer.appendChild(field);
							cardFields.appendChild(fieldContainer);
						}
						break;

					case INPUT_TYPES.IMAGE:
						for (let i = 0; i < input.numFields; i++) {
							let field = document.createElement("input");
							field.type = "hidden";
							field.name = "puzzlefield" + i;

							let span = document.createElement("span");
							span.className = "puzzlefield imagefield";
							let selectedImage = document.createElement("img");
							selectedImage.className = "selectedimage";
							cardFields.appendChild(field);
							span.appendChild(selectedImage);
							let dropdown = document.createElement("div");
							dropdown.className = "imagedropdown";
							for (let j = 1; j <= input.numImages; j++) {
								let dropdownImage = document.createElement("img");
								dropdownImage.src = "images/" + input.folderName + "/img_" + j + ".png";
								dropdownImage.addEventListener("click", function (event) {
									span.classList.remove("active");
									selectedImage.src = this.src;
									field.value = j;
								}, false);
								dropdown.appendChild(dropdownImage);
							}
							span.appendChild(dropdown);
							selectedImage.addEventListener("click", function (click) {
								if (span.classList.contains("active")) {
									span.classList.remove("active");
								} else {
									span.classList.add("active");
									let coordinates = getAbsoluteCoordinates(this);
									//display menu to right of item in mobile
									if (matchMedia("(max-width: 425px)").matches) {
										dropdown.style.left = coordinates.x + this.offsetWidth + "px";
										dropdown.style.top = coordinates.y + "px";
									} else {
										dropdown.style.left = coordinates.x + "px";
										dropdown.style.top = coordinates.y + this.offsetHeight + "px";
									}
								}
							}, false);
							cardFields.appendChild(span);
						}
						break;
				}
			} else {
				popupMessage("Please enter a valid card number", true);
			}

		}, false);

		//submit puzzle form
		puzzleEntryForm.addEventListener("submit", function (event) {
			event.preventDefault();
			let id = parseInt(this.dataset.currentCard),
				card = cards.get(id),
				numFields = card.input.numFields;
				
			let success = true;
			for (let i = 0; i < numFields; i++) {
				let value = this.elements["puzzlefield" + i].value;
				//make sure they entered something in the field
				if (value == "") {
					let message = "Enter a value";
					if (numFields > 1) message += " in each field";
					message += " before clicking submit";
					popupMessage(message, true);
					return;
				} else if (card.expectedValues.length == 0 //empty expected values for red herring / fake fields with no correct entries
					|| value != card.expectedValues[i]
				) {
					success = false;
				}
			}
			if (!success) {
				failedEntry(card.failure);
				this.reset();
				return;
			}
			
			//if we made it to the end with no failure, then give success message
			let message = card.success + " Collect the following items:";
			if (FINAL_CARD.id == card.id) {
				//stop timer on final card
				stopTimer();
				
				//bad ending if timed out
				if (timedOut) {
					message += " Card " + FINAL_CARD.timeout;
				} else {
					message += " Card " + FINAL_CARD.success;
				}
			} else {
				card.collectItems.forEach(function (item) {
					if (!isNaN(item) && parseInt(item) < 10) item = "0" + item;
					message += (isNaN(item) && !item.match(/^L[A-Z]$/) ? " Envelope " : " Card ") + item + ',';
				});
				message = message.slice(0, -1); //remove trailing comma
			}
			
			if (card.discardItems.length > 0) {
				message += ". Discard the following cards: ";
				card.discardItems.forEach(function (item) {
					if (parseInt(item) < 10) item = "0" + item;
					message += item + ", ";
				});
				message = message.slice(0, -2); //remove trailing comma
			}
			
			popupMessage(message, false);

			//reset form for next card
			puzzleEntryContainer.classList.remove("active");
			cardFields.innerHTML = "";
			cardEntryForm.reset();

			//add to list of submitted cards
			submittedCards.push(id);
			setStorage("submittedCards", submittedCards);
		}, false);

		//clear image inputs on reset
		puzzleEntryForm.addEventListener("reset", function (event) {
			let id = parseInt(this.dataset.currentCard),
				card = cards.get(id);
			if (card.input.type == INPUT_TYPES.IMAGE) {
				//clear hidden inputs
				for (let i = 0; i < this.elements.length; i++) {
					let element = this.elements[i];
					if (element.type == "hidden") element.value = "";
				}

				//reset image display
				let images = this.getElementsByClassName("selectedimage");
				for (let i = 0; i < images.length; i++) {
					images[i].src = "";
				}
			}
		}, false);
		
		//initial display of timer
		timer.textContent = ("0" + MAX_TIME).slice(-2) + ":00";
	}, false);
	
	/**
	 * @summary start game timer
	 * @param {Number} startTime preset start time (for resuming game)
	 */
	function startTimer(startTime = 0) {
		setStorage("basetime", baseTime);
				
		let timer = document.getElementById("timer");
		//timer script from https://stackoverflow.com/a/20618517/2136840
		//start timer
		let start,
			remain,
			minutes,
			seconds;
		
		if (startTime > 0) {
			start = startTime;
		} else {
			start = Date.now();
			//persist timer with local storage
			setStorage("startTime", start);
		}
		
		countdown = setInterval(function () {
			//get number of seconds elapsed
			remain = baseTime * 60 - (Date.now() - start) / 1000;
			
			if (remain <= 0) {
				timer.textContent = "00:00";
				stopTimer();
				timedOut = true;
				return;
			}
			
			// does the same job as parseInt truncates the float
			minutes = (remain / 60) | 0;
			seconds = (remain % 60) | 0;
			
			minutes = minutes < 10 ? "0" + minutes : minutes;
			seconds = seconds < 10 ? "0" + seconds : seconds;
			
			timer.textContent = minutes + ":" + seconds;
		}, 500);
	}
	
	/**
	 * @summary stop game timer
	 */
	function stopTimer() {
		clearInterval(countdown);
		if (typeof window.localStorage != "undefined") localStorage.clear();
	}
	
	/**
	 * @summary hide instructions, show card entry
	 */
	function startGame() {
		let startContainer = document.getElementById("startcontainer"),
			cardEntryContainer = document.getElementById("cardentrycontainer"),
			instructions = document.getElementById("instructions");
		instructions.open = false;
		startContainer.classList.remove("active");
		cardEntryContainer.classList.add("active");
	}
	
	/**
	 * @summary check whether given coordinates are located inside given element boundaries
	 * @param {HTMLElement} element element to check
	 * @param {number} x x coordinate
	 * @param {number} y y coordinate
	 * @returns {boolean} element contains coordinates
	 */
	function containsCoordinates(element, x, y) {
		if (!(element instanceof HTMLElement)) return false;
		//check children; absolutely positioned elements may not include child coordinates
		let childNodes = element.childNodes;
		for (let i = 0; i < childNodes.length; i++) {
			if (containsCoordinates(childNodes[i], x, y)) return true;
		}
		let bounds = element.getBoundingClientRect();
		return (
			x >= bounds.left &&
			x <= bounds.right &&
			y >= bounds.top &&
			y <= bounds.bottom
		);
	}

	/**
	 * @summary get coordinates of element in scroll
	 * @param {HTMLElement} element element to locate
	 * @returns {Object} object containing coordinates x and y
	 */
	function getAbsoluteCoordinates(element) {
		if (element instanceof HTMLElement) {
			let bounds = element.getBoundingClientRect();
			return {
				x: bounds.left,
				y: bounds.top
			};
		} else {
			return {
				x: 0,
				y: 0
			};
		}
	}
	
	/**
	 * set value in local storage
	 * @param {String} name item key
	 * @param {String} value item value
	 */
	function setStorage(name, value) {
		if (typeof window.localStorage != "undefined") {
			localStorage.setItem(name, value);
		}
	}
	
	/**
	 * get value in local storage with simulated expiration based on startTime value
	 * @param {String} name item key to grab
	 */
	function getStorage(name) {
		if (typeof window.localStorage == "undefined") return null;
		let value = localStorage.getItem(name),
			startTime = (name == "startTime") ? value : localStorage.getItem("startTime");
		if (startTime - Date.now())
		if ((Date.now() - startTime) / 1000 >= baseTime * 60) {
			localStorage.clear();
			return null;
		} else {
			return value;
		}
	}
	
	//remove active image dropdown(s) on clicking elsewhere on the page
	document.addEventListener("mousedown", function (event) {
		let activeElts = document.querySelectorAll("span.imagefield.active");
		for (let i = 0; i < activeElts.length; i++) {
			let dropdown = activeElts[i].getElementsByClassName("imagedropdown")[0];
			if (!containsCoordinates(dropdown, event.clientX, event.clientY)) {
				activeElts[i].classList.remove("active");
			}
		}
	}, false);

	//set of card => field mappings
	var cards = new CardSet();

	//Tomahna
	cards.addCard(new Card(6,
		new NumericInput(),
		[],
		"",
		"The key does not seem to fit here.",
		[],
		[]
	));
	cards.addCard(new Card(11,
		new NumericInput(),
		[],
		"",
		"The key does not seem to fit here.",
		[],
		[]
	));
	cards.addCard(new Card(7,
		new NumericInput(),
		[19],
		"The drawer opens to reveal a note and another strange 3D object.",
		"The key does not seem to fit here.",
		[26, 'B'],
		[7, 19]
	));
	cards.addCard(new Card(21,
		new NumericInput(4, 0, 9),
		[0, 2, 4, 0],
		"An image appears on the control panel's screen.",
		"Nothing happens.",
		[37],
		[21, 26]
	));
	cards.addCard(new Card(18,
		new NumericInput(4, 1, 12),
		[1, 4, 5, 11],
		"You open the case to reveal even more 3D objects.",
		"You fail to open the case.",
		['C'],
		[18, 37]
	));
	cards.addCard(new Card(16,
		new NumericInput(),
		[49],
		"You open the locked box to find a linking book.",
		"The box doesn't open.",
		['LK'],
		[6, 11, 13, 16]
	));

	//Kadish Tolesa
	cards.addCard(new Card(5,
		new ImageInput(1, "relto_pages", 8),
		[3], //gehn's cannen
		"You notice the image resembles Gehn's cannen.",
		"Nothing happens.",
		[17, 'E'],
		[5]
	));
	cards.addCard(new Card(17,
		new NumericInput(),
		[20],
		"After successfully assembling the tiles, a panel opens on the far side and you find a linking book and another 3D object.",
		"Nothing happens.",
		['LC', 'F'],
		[17]
	));

	//Channelwood
	cards.addCard(new Card(31,
		new NumericInput(1, 1, 8),
		[7],
		"You open the drawer to find a familiar-looking symbol. In the distance you hear something humming to life.",
		"The drawer doesn't open.",
		[29],
		[31]
	));
	cards.addCard(new Card(8,
		new ImageInput(1, "selenitic_sounds", 5),
		[4], //chasm
		"You see a message from Sirrus to Achenar. While much of it is rather cryptic, he reminds his brother where to find the linking book he hid.",
		"You see a nonsensical message from Achenar.",
		['LR', 'G'],
		[2, 8, 14, 15, 23, 29]
	));

	//Riven
	cards.addCard(new Card(3,
		new NumericInput(3, 1, 9),
		[1, 6, 4],
		"Inside the drawer you find yet another 3D animal. You also hear the control panel on the incinerator come to life.",
		"The drawer doesn't open.",
		['H'],
		[1, 3, 9, 12]
	));
	cards.addCard(new Card(25,
		new NumericInput(),
		[34],
		"As you crush the hollow egg, out tumble a handful of fire marbles.",
		"Nothing happens.",
		[1],
		[25, 34]
	));
	cards.addCard(new Card(42,
		new NumericInput(),
		[22],
		"Focusing the lens on the blurry text of the paper reveals a clear message.",
		"That doesn't seem to do anything.",
		[9],
		[22, 42]
	));
	cards.addCard(new Card(39,
		new ImageInput(4, "moiety_animals", 25),
		[5, 24, 13, 4], //bat, elephant, mole, whark
		"The incinerator door opens. Fortunately the linking book inside is unburned.",
		"The door doesn't open.",
		[], //final card handled separately
		[32, 39]
	));
})();