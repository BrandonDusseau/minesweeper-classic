/*
 * Minesweeper Classic, a Microsoft Minesweeper clone for the browser
 * Copyright (c) 2015-2016 Brandon Dusseau
 * Licensed with the MIT license; see LICENSE file for details
 *
 * http://www.github.com/BrandonDusseau/minesweeper-classic
 */

(function ()
{
	/*****************************************************
	 * Initialization
	 *****************************************************/

	// Check that the required environment is present
	if (typeof window.SweeperOSEnvironment == "undefined")
	{
		console.log("Sweeper OS envrionment is unavailable. Minesweeper cannot run.");
		return;
	}

	// Get the environment
	var env = window.SweeperOSEnvironment;

	var timer        = null;  // Interval timer to handle clock
	var time         = 0;     // Time elapsed in game
	var timerEnabled = true;  // True to enable the game timer
	var gameWaiting  = true;  // Whether game is waiting to start
	var noMoves      = true;  // Whether no moves have been made yet
	var gameOver     = false; // Whether the game has ended (win or explode)
	var minesLeft    = 0;     // Number of mines unflagged. from the user perspective
	var maxMines     = 0;     // Number of mines in the game
	var difficulty   = 0;     // Difficulty level. 0 = Beginner, 1 = Interm., 2 = Expert, 3 = Custom
	var boardWidth   = 0;     // Number of tiles across the board
	var boardHeight  = 0;     // Number of tiles down the board
	var tiles        = null;  // Array of game tiles ([row][column])
	var tilesLeft    = 0;     // Number of uncovered tiles left, excluding mines
	var tileActive   = false; // Whether the mouse button was pressed down on a tile
	var groupActive  = false; // Whether the middle button was pressed down on a tile
	var allowMarks   = true;  // Whether ? tiles are allowed
	var allowSound   = false; // Whether sound plays on certain events
	var allowColor   = true;  // Whether to display a color gameboard
	var customSet    = false; // Whether the board has custom dimensions set up
	var customWidth  = 9;     // Width of board on custom level
	var customHeight = 9;     // Height of board on custom level
	var customMines  = 10;    // Number of mines on board on custom level
	var firstGame    = true;  // Whether this is the first game (used for initialization)
	var middleActive = false; // True when the middle mouse button is being held down (used for timer stop)
	var cheatActive  = false; // Whether the cheat pixel is turned on
	var cheatStep    = 0;     // The current step of the cheat activation process

	// Initialize the leaderboard
	var leaderboard = [
		["Anonymous", 999], // Beginner
		["Anonymous", 999], // Intermediate
		["Anonymous", 999]  // Expert
	];

	/**
	 * Tile object definition
	 *
	 * @return {undefined}
	 */
	function Tile()
	{
		this.number = 0;
		this.isMine = false;
		this.flagged = false;
		this.marked = false;
		this.triggered = false;
		this.exploded = false;
	}

	/*****************************************************
	 * Event Bindings
	 *****************************************************/

	// When the page has loaded, initialize the game
	$(document).ready(function ()
	{
		// Handle global mouseup
		$("body").on("mouseup", function ()
		{
			// Set smiley back to :)
			$(".smiley-icon").removeClass("active");

			// Reset mousedown triggers
			tileActive = false;
			groupActive = false;

			// If middle mouse is down, raise all down tiles
			$(".ms-panel.down").removeClass("down");
		});

		// Bind keys
		$("body").on("keydown", function (e)
		{
			// Bind keys to Minesweeper window
			if ($(".window#ms-main").hasClass("focused"))
			{
				// F2 - new game
				if (e.which == 113)
				{
					e.preventDefault();
					initGame(difficulty);
				}
				// F1 - Help
				else if (e.which == 112)
				{
					e.preventDefault();
					openHelp();
				}
				// ESC - Timer stop feature
				else if (e.which == 27)
				{
					if (middleActive)
					{
						timerEnabled = false;
					}
				}

				// If the XYZZY cheat code is not active, handle the activation sequence (XYZZY + shift)
				if (!cheatActive)
				{
					// XYZ
					if ((e.which == 88 && cheatStep) == 0 ||
						(e.which == 89 && (cheatStep == 1 || cheatStep == 4) ||
						(e.which == 90 && (cheatStep == 2 || cheatStep == 3))))
					{
						cheatStep++;
					}
					// Shift
					else if (e.which == 16 && cheatStep == 5)
					{
						$("#pixel").css("display", "block");
						cheatActive = true;
					}
					// Any out of sequence key resets the cheat state
					else
					{
						cheatStep = 0;
					}
				}

				return;
			}

			// Bind keys to custom board dialog
			if ($(".window#ms-custom-board").hasClass("focused"))
			{
				// ESC - cancel
				if (e.which == 27)
				{
					customBoardCancel();
				}
				// Enter - whichever button is active, or confirm if text box is active
				else if (e.which == 13)
				{
					if ($(".cst-form input").is(":focus"))
					{
						customBoardConfirm();
					}
					else
					{
						$("#ms-custom-board .btns .btn-container.active").click();
					}
				}
				return;
			}

			// Bind keys to high score dialog
			if ($(".window#ms-high-score").hasClass("focused"))
			{
				// ESC / Enter - OK
				if (e.which == 27 || e.which == 13)
				{
					highScoreConfirm();
				}
				return;
			}

			// Bind keys to leaderboard dialog
			if ($(".window#ms-leaderboard").hasClass("focused"))
			{
				// ESC - Exit
				if (e.which == 27)
				{
					leaderboardConfirm();
				}
				// Enter - whichever button is active
				else if (e.which == 13)
				{
					$(this).find("#ms-leaderboard .btns .btn-container.active").click();
				}
				return;
			}

			// Bind keys to about dialog
			if ($(".window#ms-about").hasClass("focused"))
			{
				// ESC / Enter - OK
				if (e.which == 27 || e.which == 13)
				{
					aboutConfirm();
				}
				return;
			}

			// Bind keys to help dialog
			if ($(".window#ms-help").hasClass("focused"))
			{
				// ESC / Enter - OK
				if (e.which == 27 || e.which == 13)
				{
					helpConfirm();
				}
				return;
			}
		});

		// Any click in the minesweeper space will trigger the active face
		$(".minesweeper").off("mousedown").on("mousedown", function (e)
		{
			// If the window is frozen, do not perform the action
			if ($(this).closest(".window").hasClass("modal-frozen"))
			{
				return;
			}

			if (!gameOver && (e.which == 1 || e.which == 2))
			{
				// Set smiley icon to 8O face
				$(".smiley-icon").addClass("active");
			}

			if (e.which == 2)
			{
				// Set middle click held for timer stop feature
				middleActive = true;
			}
		});

		// Handle middle mouseup on the whole game board, for timer stop feature
		$(".minesweeper").off("mouseup").on("mouseup", function ()
		{
			middleActive = false;
		});


		// Smiley button click
		$(".smiley-btn").off("click").on("click", function ()
		{
			// Reset the game at the current difficulty
			initGame(difficulty);
		});

		// New game menu option
		$("#game_new").on("click", function ()
		{
			initGame(difficulty);
		});

		// Beginner menu option
		$("#game_beg:not(.disabled)").on("click", function ()
		{
			setDifficulty(0);
		});

		// Intermediate menu option
		$("#game_int:not(.disabled)").on("click", function ()
		{
			setDifficulty(1);
		});

		// Expert menu option
		$("#game_exp:not(.disabled)").on("click", function ()
		{
			setDifficulty(2);
		});

		// Custom menu option
		$("#game_cst:not(.disabled)").on("click", function ()
		{
			// Open the customization dialog and position it at the top left of the game board
			// Also, preload it with the current values of the custom board
			var containerOffset = $(".minesweeper").offset();
			$("#ms-custom-board #cst-height").val(customHeight);
			$("#ms-custom-board #cst-width").val(customWidth);
			$("#ms-custom-board #cst-mines").val(customMines);
			env.showWindow($("#ms-custom-board"), containerOffset.left, containerOffset.top, $("#ms-main"));
		});

		// Enable/disabled mark tile menu option
		$("#game_mrk:not(.disabled)").on("click", function ()
		{
			setMarks(!allowMarks);
		});

		// Enable/disable sound
		$("#game_snd:not(.disabled)").on("click", function ()
		{
			setSound(!allowSound);
		});

		// Enable/disable color
		$("#game_clr:not(.disabled)").on("click", function ()
		{
			setColor(!allowColor);
		});

		// Open the leaderboard
		$("#game_ldr:not(.disabled)").on("click", function ()
		{
			openLeaderboard();
		});

		// Open the about dialog
		$("#help_abt:not(.disabled)").on("click", function ()
		{
			openAbout();
		});

		// Open the help dialog
		$("#help_play:not(.disabled)").on("click", function ()
		{
			openHelp();
		});

		// Commit the changes in the custom field dialog
		$("#cst_ok").on("click", customBoardConfirm);

		// Cancel the changes in the custom field dialog
		$("#cst_cancel").on("click", customBoardCancel);

		// Commit the changes in the high score dialog
		$("#hs_ok").on("click", highScoreConfirm);

		// Close the leaderboard dialog
		$("#leader_ok").on("click", leaderboardConfirm);

		// Reset the leaderboard
		$("#leader_reset").on("click", resetLeaderboard);

		// Close the about dialog
		$("#about_ok").on("click", aboutConfirm);

		// Close the help dialog
		$("#help_ok").on("click", helpConfirm);

		// Initialize the game
		preload();
	});

	/**
	 * Binds events to elements which might be regenerated
	 * This must happen every time the game is initialized to ensure bindings don't get lost
	 *
	 * @return {undefined}
	 */
	function rebindEvents()
	{
		// Block context menu on windows
		$(".window *").off("contextmenu").on("contextmenu", function (e)
		{
			e.preventDefault();
		});

		// Handle mousedown on a mine panel
		$(".minesweeper .ms-panel").off("mousedown").on("mousedown", function (e)
		{
			// If the window is frozen, do not perform the action
			if ($(this).closest(".window").hasClass("modal-frozen"))
			{
				return;
			}

			// Left mouse button when game has not ended and panel is not triggered
			if (!gameOver)
			{
				switch (e.which)
				{
					case 1:
						// Left mouse press
						tileActive = true;
						$(this).trigger("mouseenter");
						break;
					case 2:
						// Middle mouse press
						groupActive = true;
						$(this).trigger("mouseenter");
						break;
					case 3:
						// Right mouse press - forward the event to the click handler
						var target = $(this);
						handlePanelClick(target, e);
						break;
					default:
						break;
				}
			}
		});

		// Handle mouseenter on a mine panel (if the mouse button was clicked)
		// Also handle the cheat pixel color here, if the cheat is turned on
		$(".minesweeper .ms-panel").off("mouseenter").on("mouseenter", function ()
		{
			var coords = getCoords($(this));

			if (tileActive && !$(this).hasClass("flagged"))
			{
				// Apply the down action
				$(this).addClass("down");
			}
			else if (groupActive)
			{
				// Apply the down action on element and all surrounding it
				var tileRange = getTileRange(coords[0], coords[1]);

				for (var currentRow = tileRange[0][0]; currentRow <= tileRange[0][1]; currentRow++)
				{
					for (var currentCol = tileRange[1][0]; currentCol <= tileRange[1][1]; currentCol++)
					{
						if (!isFlagged(currentRow, currentCol))
						{
							$(".ms-panel[data-coord=\"" + currentRow + "," + currentCol + "\"]").addClass("down");
						}
					}
				}
			}

			if (cheatActive)
			{
				if (isMine(coords[0], coords[1]))
				{
					$("#pixel").css("background-color", "#000");
				}
				else
				{
					$("#pixel").css("background-color", "#FFF");
				}
			}
		});

		// Handle mouseleave on a mine panel
		$(".minesweeper .ms-panel").off("mouseleave").on("mouseleave", function (e)
		{
			// Left or middle mouse button will cause all downed tiles to reset
			if ((tileActive || groupActive) && (e.which == 1 || e.which == 2))
			{
				// Remove the down class
				$(".ms-panel.down").removeClass("down");
			}
		});

		// Handle mouseup on mine panel
		$(".minesweeper .ms-panel").off("mouseup").on("mouseup", function (e)
		{
			if ((tileActive || groupActive) && !gameOver)
			{
				// If game hasn't started yet, start it!
				if (gameWaiting)
				{
					startGame();
				}

				var target = $(this);
				handlePanelClick(target, e);
			}
		});
	}

	/*****************************************************
	 * UI Interaction Functions
	 *****************************************************/

	/**
	 * Preloads necessary assets before starting the game
	 *
	 * @return {undefined}
	 */
	function preload()
	{
		$("body").addClass("loading");

		var preloadImages = ["about_header.gif", "sprite.gif", "spritebw.gif", "bw_bg.gif", "cursor_default.gif", "cursor_pointer.gif"];
		var promises = [];

		var loadAsset = function (url, promise)
		{
			var asset = new Image();
			asset.onload = function ()
			{
				promise.resolve();
			};

			asset.src = url;
		};

		// Preload images
		for (var img = 0; img < preloadImages.length; img++)
		{
			promises[img] = $.Deferred();
			loadAsset("img/" + preloadImages[img], promises[img]);
		}

		// Launch the game when we're ready
		$.when.apply($, promises).done(function ()
		{
			$("body").removeClass("loading");
			initGame(0);
		});
	}

	/**
	 * Event handler for custom board dialog OK
	 *
	 * @return {undefined}
	 */
	function customBoardConfirm()
	{
		// Set up a new game board with the custom parameters
		var cstWidth = $("#cst-width").val();
		var cstHeight = $("#cst-height").val();
		var cstMines = $("#cst-mines").val();

		setCustomBoard(cstWidth, cstHeight, cstMines);
		setDifficulty(3);
		env.closeWindow($("#ms-custom-board"));
	}

	/**
	 * Event handler for custom board dialog cancel
	 *
	 *
	 * @return {undefined}
	 */
	function customBoardCancel()
	{
		// Canceling the custom dialog results in resetting the current game board
		initGame(difficulty);
		env.closeWindow($("#ms-custom-board"));
	}

	/**
	 * Event handler for high score dialog OK
	 *
	 * @return {undefined}
	 */
	function highScoreConfirm()
	{
		updateLeaderboard(difficulty, $("#ms-high-score #hs-name").val(), time);
		env.closeWindow($("#ms-high-score"));
		openLeaderboard();
	}

	/**
		* Event handler for leaderboard dialog OK
		*
		* @return {undefined}
		*/
	function leaderboardConfirm()
	{
		env.closeWindow($("#ms-leaderboard"));
	}

	/**
		* Opens the leaderboard window
		*
		* @return {undefined}
		*/
	function openLeaderboard()
	{
		var containerOffset = $(".minesweeper").offset();
		var statusOffset = $(".ms-status").offset().top + $(".ms-status").outerHeight();
		env.showWindow($("#ms-leaderboard"), containerOffset.left, statusOffset, $("#ms-main"));
	}

	/**
		* Opens the about window
		*
		* @return {undefined}
		*/
	function openAbout()
	{
		var containerOffset = $(".minesweeper").offset();
		env.showWindow($("#ms-about"), containerOffset.left + 30, containerOffset.top + 33, $("#ms-main"));
	}

	/**
		* Event handler for about dialog OK
		*
		* @return {undefined}
		*/
	function aboutConfirm()
	{
		env.closeWindow($("#ms-about"));
	}

	/**
		* Opens the help window
		*
		* @return {undefined}
		*/
	function openHelp()
	{
		var containerOffset = $(".minesweeper").offset();
		env.showWindow($("#ms-help"), containerOffset.left + 30, containerOffset.top + 33, $("#ms-main"));
	}

	/**
		* Event handler for help dialog OK
		*
		* @return {undefined}
		*/
	function helpConfirm()
	{
		$("#ms-help .help-content-inner").scrollTop(0);
		env.closeWindow($("#ms-help"));
	}

	/**
	 * Enables or disables sound
	 *
	 * @param {boolean} enabled True to enable, false to disable
	 * @param {boolean} skipSave If true, do not save preference
	 * @return {undefined}
	 */
	function setSound(enabled, skipSave)
	{
		// Apply the setting
		if (enabled == true)
		{
			allowSound = true;
			$("#game_snd").addClass("checked");
		}
		else
		{
			allowSound = false;
			$("#game_snd").removeClass("checked");
		}

		// Write preference to local storage if enabled
		if (!skipSave)
		{
			setLocalStorageValue("snd", allowSound);
		}
	}

	/**
	 * Enables or disables marks (?)
	 *
	 * @param {boolean} enabled True to enable, false to disable
	 * @param {boolean} skipSave If true, do not save preference
	 * @return {undefined}
	 */
	function setMarks(enabled, skipSave)
	{
		// Apply the setting
		if (enabled == true)
		{
			allowMarks = true;
			$("#game_mrk").addClass("checked");
		}
		else
		{
			allowMarks = false;
			$("#game_mrk").removeClass("checked");
		}

		// Write preference to local storage if enabled
		if (!skipSave)
		{
			setLocalStorageValue("mrk", allowMarks);
		}
	}

	/**
	 * Enables or disables color display
	 *
	 * @param {boolean} enabled True to enable, false to disable
	 * @param {boolean} skipSave If true, do not save preference
	 * @return {undefined}
	 */
	function setColor(enabled, skipSave)
	{
		// Apply the setting
		if (enabled == true)
		{
			allowColor = true;
			$("#game_clr").addClass("checked");
			$(".minesweeper").removeClass("no-color");
		}
		else
		{
			allowColor = false;
			$("#game_clr").removeClass("checked");
			$(".minesweeper").addClass("no-color");
		}

		// Write preference to local storage if enabled
		if (!skipSave)
		{
			setLocalStorageValue("clr", allowColor);
		}
	}

	/**
	 * Sets the difficulty level
	 *
	 * @param {int} diff level
	 * @param {boolean} skipSave If true, do not save preference
	 * @return {undefined}
	 */
	function setDifficulty(diff, skipSave)
	{
		// Only accept valid levels
		if (diff < 0 || diff > 3)
		{
			return;
		}

		// Reset custom board if switching away from it
		if (diff != 3)
		{
			customWidth = 9;
			customHeight = 9;
			customMines = 10;
			customSet = false;
		}

		// Adjust the context menu entries
		var lvl = ["beg", "int", "exp", "cst"];
		for (var currentLvl = 0; currentLvl < lvl.length; currentLvl++)
		{
			var element = $("#game_" + lvl[currentLvl]);
			if (currentLvl == diff)
			{
				element.addClass("checked");
			}
			else
			{
				element.removeClass("checked");
			}
		}

		// Write preference to local storage if enabled
		if (!skipSave)
		{
			setLocalStorageValue("lvl", diff);
		}

		// Apply the setting
		initGame(diff);
	}

	/**
	 * Sets up custom board dimensions
	 *
	 * @param {int} width  Width of board
	 * @param {int} height Height of board
	 * @param {int} mines  Number of mines to place
	 * @param {boolean} skipSave If true, do not save preference
	 * @return {undefined}
	 */
	function setCustomBoard(width, height, mines, skipSave)
	{
		// Override invalid board preferences
		// Width must be a decimal integer
		if (!/^\d*$/.test(width))
		{
			width = 9;
		}

		// Width must be between 9 and 30, inclusive
		width = (width > 30 ? 30 : width);
		width = (width < 9 ? 9 : width);

		// Height must be a decimal integer
		if (!/^\d*$/.test(height))
		{
			height = 9;
		}

		// Height must be between 9 and 24, inclusive
		height = (height > 24 ? 24 : height);
		height = (height < 9 ? 9 : height);

		// Number of mines must be a decimal integer
		if (!/^\d*$/.test(mines))
		{
			mines = 10;
		}

		// Mines must be between 10 and (x-1)(y-1), inclusive
		mines = (mines < 10 ? 10 : mines);
		var minesAllowed = (height - 1) * (width - 1);
		mines = (mines > minesAllowed ? minesAllowed : mines);

		// Update the game state
		customSet = true;
		customWidth = width;
		customHeight = height;
		customMines = mines;

		// Write preference to local storage if enabled
		if (!skipSave)
		{
			setLocalStorageValue("board_width", width);
			setLocalStorageValue("board_height", height);
			setLocalStorageValue("board_mines", mines);
		}
	}

	/**
	 * Handles clicks for ms-panel elements
	 *
	 * @param {jquery} target The element attached to the event
	 * @param {event} ev Event properties
	 * @return {undefined}
	 */
	function handlePanelClick(target, ev)
	{
		// A target of type ms-panel must be provided
		if (!target.length || !target.hasClass("ms-panel"))
		{
			return;
		}

		// Load the coordinates of the target element
		var coord = getCoords(target);
		var row = coord[0];
		var col = coord[1];

		// Left click
		if (ev.which == 1)
		{
			// Set smiley back to :)
			$(".smiley-icon").removeClass("active");
			tileActive = false;

			// Only handle left clicks if the game hasn't ended
			if (!gameOver)
			{
				if (!isTriggered(row, col))
				{
					trigger(row, col);
				}
			}
		}
		// Middle click (only on numbered tiles)
		if (ev.which == 2 && isNumber(row, col) && isTriggered(row, col))
		{
			var tileRange = getTileRange(row, col);
			var triggerQueue = [];

			// Number of flags left to find in range
			var flagsLeft = getNumber(row, col);

			// Go through each tile around the one clicked
			for (var currentRow = tileRange[0][0]; currentRow <= tileRange[0][1]; currentRow++)
			{
				for (var currentCol = tileRange[1][0]; currentCol <= tileRange[1][1]; currentCol++)
				{
					// Skip the clicked tile
					if (currentRow == row && currentCol == col)
					{
						continue;
					}

					// If tile is flagged, subtract from number of flags left
					if (isFlagged(currentRow, currentCol))
					{
						flagsLeft--;
					}
					// Otherwise, add to the trigger queue
					else
					{
						triggerQueue.push([currentRow, currentCol]);
					}
				}
			}

			// If there are the wrong number of flags, abort!
			if (flagsLeft != 0)
			{
				return;
			}

			// Reorder the trigger queue to put mines last
			// This guarantees that non-mine tiles will trigger before
			// a game-ending explosion.
			var tilesInQueue = triggerQueue.length;
			for (var currentTile = 0; currentTile < tilesInQueue; currentTile++)
			{
				var tRow = triggerQueue[currentTile][0];
				var tCol = triggerQueue[currentTile][1];

				if (isMine(tRow, tCol))
				{
					triggerQueue.splice(currentTile, 1);
					triggerQueue.push([tRow, tCol]);

					// Shorten the array and rewind
					tilesInQueue--;
					currentTile--;
				}
			}

			// Trigger the mines--err.. tiles. >:)
			for (var currentMine = 0; currentMine < triggerQueue.length; currentMine++)
			{
				var mRow = triggerQueue[currentMine][0];
				var mCol = triggerQueue[currentMine][1];
				trigger(mRow, mCol);
			}
		}
		// Right click
		else if (ev.which == 3)
		{
			// Handle flagging and marking tiles
			if (!gameOver && !isTriggered(row, col))
			{
				// If tile is "fresh", add a flag
				if (!isFlagged(row, col) && !isMarked(row, col))
				{
					flag(row, col);
					subMine();
				}
				// If tile is flagged and it is allowed, mark the tile
				else if (allowMarks && isFlagged(row, col))
				{
					// Mark the tile and restore a mine to the counter
					mark(row, col);
					addMine();
				}
				// Tile must be marked, so clear it
				else
				{
					// If marks aren't allowed, add back the mine value here instead
					if (!allowMarks)
					{
						addMine();
					}

					clear(row, col);
				}
			}
		}
	}

	/*****************************************************
	 * Tile Control and Metadata Functions
	 *****************************************************/

	/**
	 * Gets coordinates of a mine panel
	 *
	 * @param {jquery} target Element from which to get coordinates
	 * @return {array} Coordinates of tile [y,x]
	 */
	function getCoords(target)
	{
		var coords = target.data("coord").split(",");
		return [parseInt(coords[0], 10), parseInt(coords[1], 10)];
	}

	/**
	 * Flags a tile
	 *
	 * @param {int} row Row to set
	 * @param {int} col Column to set
	 * @return {undefined}
	 */
	function flag(row, col)
	{
		var tile = tiles[row][col];

		// Tile may only be flagged if it is fresh
		if (!gameOver && !tile.triggered && !tile.marked)
		{
			tiles[row][col].flagged = true;
		}

		// Rerender the tile in its new state
		rerender(row, col);
	}

	/**
	 * Marks a tile ("?")
	 *
	 * @param {int} row Row to set
	 * @param {int} col Column to set
	 * @return {undefined}
	 */
	function mark(row, col)
	{
		var tile = tiles[row][col];

		// Tile may only be marked if it is untriggered and flagged
		if (!gameOver && !tile.triggered && tile.flagged)
		{
			tile.flagged = false;
			tile.marked = true;
		}

		// Save the tile and rerender it
		tiles[row][col] = tile;
		rerender(row, col);
	}

	/**
	 * Clears marked and flagged statuses on a tile
	 *
	 * @param {int} row Row to set
	 * @param {int} col Column to set
	 * @return {undefined}
	 */
	function clear(row, col)
	{
		var tile = tiles[row][col];

		// Tile may only be cleared if not triggered
		if (!gameOver && !tile.triggered)
		{
			tile.marked = false;
			tile.flagged = false;
		}

		// Save the tile and rerender it
		tiles[row][col] = tile;
		rerender(row, col);
	}

	/**
	 * Sets a tile as a mine
	 *
	 * @param {int} row Row to set
	 * @param {int} col Column to set
	 * @return {undefined}
	 */
	function mine(row, col)
	{
		tiles[row][col].isMine = true;
	}

	/**
	 * Checks whether a tile is triggered
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {boolean} True if tile is triggered, false otherwise
	 */
	function isTriggered(row, col)
	{
		return tiles[row][col].triggered;
	}

	/**
	 * Checks whether a tile is a number
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {boolean} True if tile is a number, false otherwise
	 */
	function isNumber(row, col)
	{
		return tiles[row][col].number != 0;
	}

	/**
	 * Checks whether a tile is marked
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {boolean} True if tile is marked, false otherwise
	 */
	function isMarked(row, col)
	{
		return tiles[row][col].marked;
	}

	/**
	 * Checks whether a tile is flagged
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {boolean} True if tile is flagged, false otherwise
	 */
	function isFlagged(row, col)
	{
		return tiles[row][col].flagged;
	}

	/**
	 * Checks whether a tile is a mine
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {boolean} True if tile is a mine, false otherwise
	 */
	function isMine(row, col)
	{
		return tiles[row][col].isMine;
	}

	/**
	 * Returns the number of a tile
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {int} Number of tile
	 */
	function getNumber(row, col)
	{
		return tiles[row][col].number;
	}

	/*****************************************************
	 * Tile Actions
	 *****************************************************/

	/**
	 * Adds a mine to the mine counter
	 *
	 * @return {undefined}
	 */
	function addMine()
	{
		if (minesLeft < maxMines)
		{
			minesLeft++;
			digitRender("mines", minesLeft);
		}
	}

	/**
	 * Removes a mine from the mine counter
	 *
	 * @return {undefined}
	 */
	function subMine()
	{
		if (minesLeft > -99)
		{
			minesLeft--;

			// Render the count or -99 if it's too low
			digitRender("mines", (minesLeft > -100) ? minesLeft : -99);
		}
	}

	/**
	 * Triggers a tile
	 *
	 * @param {int} row Row to trigger
	 * @param {int} col Column to trigger
	 * @return {undefined}
	 */
	function trigger(row, col)
	{
		var tile = tiles[row][col];

		// Cannot trigger a tile that has already been triggered or flagged
		if (gameOver || tile.triggered || tile.flagged)
		{
			return;
		}

		// Mark the tile as triggered
		tile.triggered = true;

		// Save the tile
		tiles[row][col] = tile;

		// Mine explodes if triggered during game
		if (!noMoves && tile.isMine)
		{
			explode(row, col);

			// Bail out - rendering will happen post-game
			return;
		}
		// Mine must be relocated if this is the first click
		else if (noMoves && tile.isMine)
		{
			// Disable this mine and recalculate the numbers around it
			tiles[row][col].isMine = false;
			setNumbers(row, col, true);

			// Place a new mine with this tile excluded
			placeMine(row, col);
		}

		// Rerender the tile
		rerender(row, col);

		// If tile is clear, cascade to nearby tiles
		if (tile.number == 0 && !tile.isMine && !tile.flagged)
		{
			cascadeTrigger(row, col);
		}

		// If we didn't explode, we're closer to winning!
		if (--tilesLeft == 0)
		{
			winGame();
		}

		noMoves = false;
	}

	/**
	 * Cascades trigger until no more clear tiles are found
	 *
	 * @param {int} row Row subcoord for tile to check
	 * @param {int} col Column subcoord for tile to check
	 * @return {undefined}
	 */
	function cascadeTrigger(row, col)
	{
		// Do not allow checks outside the board
		var rowMinBound = (row == 0) ? 0 : row - 1;
		var rowMaxBound = (row == boardHeight - 1) ? boardHeight - 1 : row + 1;
		var colMinBound = (col == 0) ? 0 : col - 1;
		var colMaxBound = (col == boardWidth - 1) ? boardWidth - 1 : col + 1;

		// Loop through up to nine tiles
		for (var currentRow = rowMinBound; currentRow <= rowMaxBound; currentRow++)
		{
			for (var currentCol = colMinBound; currentCol <= colMaxBound; currentCol++)
			{
				// Trigger tile if it is a number or is not a mine or flagged
				var tile = tiles[currentRow][currentCol];
				if (tile.number > 0 || (!tile.isMine && !tile.flagged))
				{
					trigger(currentRow, currentCol);
				}
			}
		}
	}

	/**
	 * Detonates a mine (boom)
	 *
	 * @param {int} row Row to explode
	 * @param {int} col Column on which to make blam
	 * @return {undefined}
	 */
	function explode(row, col)
	{
		var tile = tiles[row][col];

		// Sanity check - only mines explode!
		if (!tile.isMine)
		{
			return;
		}

		// Mark tile as exploded
		tile.exploded = true;
		tiles[row][col] = tile;

		// Play explosion sound, if enabled
		if (allowSound)
		{
			document.getElementById("snd_explode").play();
		}

		// End the game!
		endGame();

		// Reveal mine tiles and incorrect flags, and leave good flags alone
		for (var currentRow = 0; currentRow < boardHeight; currentRow++)
		{
			for (var currentCol = 0; currentCol < boardWidth; currentCol++)
			{
				var tileToTrigger = tiles[currentRow][currentCol];
				var mustRender = false;

				// If this is an unflagged mine, rerender it
				if (!tileToTrigger.flagged && tileToTrigger.isMine)
				{
					mustRender = true;
				}
				// If bogus flag, remove number and rerender it
				else if (!tileToTrigger.isMine && tileToTrigger.flagged)
				{
					mustRender = true;
					tileToTrigger.number = 0;
				}

				// Trigger the tile, save it, and rerender it
				if (mustRender)
				{
					tileToTrigger.triggered = true;
					tiles[currentRow][currentCol] = tileToTrigger;
					rerender(currentRow, currentCol);
				}
			}
		}

		// Murder the smiley :(
		$(".smiley-icon").addClass("dead");
	}

	/*****************************************************
	 * UI Rendering
	 *****************************************************/

	/**
	 * Renders a tile in its current internal state
	 *
	 * @param {int} row Row to render
	 * @param {int} col Column to render
	 * @return {undefined}
	 */
	function rerender(row, col)
	{
		// Locate the target in the DOM and load its metadata
		var target = $(".ms-panel[data-coord=\"" + row + "," + col + "\"]");
		var tile = tiles[row][col];

		// Reset the state of the panel
		target.removeClass("triggered mine exploded m1 m2 m3 m4 m5 m6 m7 m8 flagged marked");

		// Some states are only available if the tile is triggered
		if (tile.triggered)
		{
			target.addClass("triggered");

			// If the tile has a number, show it
			if (tile.number > 0)
			{
				target.addClass("m" + tile.number);
			}

			// If the tile is a mine, show it
			if (tile.isMine)
			{
				target.addClass("mine");
			}

			// If the tile is a mine, show it
			if (tile.exploded)
			{
				target.addClass("exploded");
			}

			// If a triggered tile is flagged and is not a mine, show bogus marker
			if (!tile.isMine && tile.flagged)
			{
				target.addClass("bogus");
			}
		}
		else
		{
			// Show flag if tile is flagged
			if (tile.flagged)
			{
				target.addClass("flagged");
			}

			if (tile.marked)
			{
				target.addClass("marked");
			}
		}
	}

	/**
	 * Renders digits on the digital number boxes
	 *
	 * @param {string} target ID of the element to render (must be num-box class)
	 * @param {int} number Number to render on the display
	 * @return {undefined}
	 */
	function digitRender(target, number)
	{
		target = ".num-box#" + target;

		// Determine each digit of the display
		var num = Math.abs(number);
		var hundreds = Math.floor(num / 100);
		num -= hundreds * 100;
		var tens = Math.floor(num / 10);
		num -= tens * 10;

		// Make hundreds place a hyphen if negative
		if (number < 0)
		{
			hundreds = "n";
		}

		// Set the display
		$(target + " .digit").removeClass("d0 d1 d2 d3 d4 d5 d6 d7 d8 d9 dn");
		$(target + " .digit.iii").addClass("d" + hundreds);
		$(target + " .digit.ii").addClass("d" + tens);
		$(target + " .digit.i").addClass("d" + num);
	}

	/*****************************************************
	 * Game Generation
	 *****************************************************/

	/**
	 * Initializes the game
	 *
	 * @param {int} diff Difficulty of the game - see def at top of file for details
	 * @param {int} width Optional board width specification (diff = 3)
	 * @param {int} height Optional board height specification (diff = 3)
	 * @param {int} mines Optional number of mines specification (diff = 3)
	 * @return {undefined}
	 */
	function initGame(diff)
	{
		// Reset the game state
		endGame();
		gameWaiting = true;
		gameOver = false;
		noMoves = true;
		timerEnabled = true;

		// If custom settings are not set, override custom difficulty
		// Also do this if the difficulty setting is invalid
		if (diff < 0 || diff > 3 || (diff == 3 && !customSet))
		{
			diff = 0;
		}

		// Set up defaults based on difficulty level, unless using a custom setting
		var defaults = {
			"width": [9, 16, 30],
			"height": [9, 16, 16],
			"mines": [10, 40, 99]
		};

		// Set defaults if using a non-custom difficulty
		var width, height, mines;
		if (diff != 3)
		{
			width = defaults.width[diff];
			height = defaults.height[diff];
			mines = defaults.mines[diff];
		}
		else
		{
			width = customWidth;
			height = customHeight;
			mines = customMines;
		}

		// Set up initial game data
		maxMines = mines;
		minesLeft = mines;
		boardWidth = width;
		boardHeight = height;
		difficulty = diff;
		time = 0;
		tiles = [];
		tilesLeft = (width * height) - mines;

		// On first game, initialize some preferences
		if (firstGame)
		{
			firstGame = false;
			// Load the leaderboard from local storage, if available
			var top = getLocalStorageValue("leaderboard");
			var leaders = leaderboard;
			try
			{
				if (top != null)
				{
					leaders = $.parseJSON(top);
				}
			}
			catch (e)
			{
				// Silently reset if the leaderboard storage is malformed
				console.log("Error: leaderboard data is corrupt. Resetting to default...");
				setLocalStorageValue("leaderboard", JSON.stringify(leaderboard));
			}

			// Initialize the internal leaderboard
			for (var leaderLvl = 0; leaderLvl < 3; leaderLvl++)
			{
				updateLeaderboard(leaderLvl, leaders[leaderLvl][0], leaders[leaderLvl][1], true);
			}

			// Restore sound preference
			var sndPref = getLocalStorageValue("snd");
			sndPref = (sndPref == "true") ? true : false;
			setSound(sndPref, true);

			// Restore marks preference
			var mrkPref = getLocalStorageValue("mrk");
			mrkPref = (mrkPref == "true" || mrkPref == null) ? true : false;
			setMarks(mrkPref, true);

			// Restore color preference
			var clrPref = getLocalStorageValue("clr");
			clrPref = (clrPref == "true" || clrPref == null) ? true : false;
			setColor(clrPref, true);

			// Restore level preference
			// This must be last because it may reinitialize the game board
			var lvlPref = getLocalStorageValue("lvl");
			var bwPref = getLocalStorageValue("board_width");
			var bhPref = getLocalStorageValue("board_height");
			var bmPref = getLocalStorageValue("board_mines");
			if (lvlPref != null)
			{
				// Don't restore the preference if custom has invalid bounds
				if (lvlPref != 3 || (bwPref != null && bhPref != null && bmPref != null))
				{
					if (lvlPref == 3)
					{
						setCustomBoard(bwPref, bhPref, bmPref, true);
					}

					setDifficulty(lvlPref, true);

					// Break out so that the board does not initialize multiple times
					return;
				}
			}
		}

		// Create the grid
		generateGrid();

		// Render the numeric displays with initial values
		digitRender("time", time);
		digitRender("mines", minesLeft);

		// Reset the smiley icon :)
		$(".smiley-icon").removeClass("active cool dead");

		// Bind event handlers
		rebindEvents();

		// Display the window if it was hidden
		env.showWindow($("#ms-main"), 40, 40);
	}

	/**
	 * Generates game grid in memory and then renders the displayed grid
	 *
	 * @return {undefined}
	 */
	function generateGrid()
	{
		var grid = "";
		// Cycle through rows (ms-row)
		for (var row = 0; row < boardHeight; row++)
		{
			// Create array for each row
			tiles.push([]);
			grid += "<div class='ms-row'>";

			// Cycle through each tile in the row
			for (var col = 0; col < boardWidth; col++)
			{
				// Add the default object to the game array
				tiles[row].push(new Tile());
				grid += "<div class='ms-panel' data-coord='" + row + "," + col + "'></div>";
			}

			grid += "</div>";
		}

		// Place the appropriate number of mines
		var mineNum = maxMines;
		while (mineNum--)
		{
			placeMine();
		}

		// Render the grid
		$(".ms-grid").html(grid);
	}

	/**
	 * Places a mine in a random location on the grid
	 *
	 * @param {int} exclRow Optional row to exclude from mine
	 * @param {int} exclCol Optional column to exclude from mine
	 * @return {undefined}
	 */
	function placeMine(exclRow, exclCol)
	{
		// Disable exclusion check if coordinate not provided
		var excl = typeof exclRow != "undefined";

		// Default values
		var row = -1;
		var col = -1;
		var tile = null;

		// Generate a new coordinate until a non-triggered, non-mine, unexcluded tile is found
		do
		{
			row = getRandomNumber(0, boardHeight - 1);
			col = getRandomNumber(0, boardWidth - 1);
			tile = tiles[row][col];
		}
		while (tile.isMine || (excl && row == exclRow && col == exclCol));

		// Make the tile a mine
		tiles[row][col].number = 0;
		mine(row, col);

		// Surround tile with numbers
		setNumbers(row, col);
	}

	/**
	 * Increases numbers surrounding a tile
	 *
	 * @param {int} row Row subcoord for center tile
	 * @param {int} col Column subcoord for center tile
	 * @param {boolean} recalc Optional - forces the number to be recalculated
	 * @return {undefined}
	 */
	function setNumbers(row, col, recalc)
	{
		// Loop through up to nine tiles
		var tileRange = getTileRange(row, col);
		var adjMines = 0;
		for (var currentRow = tileRange[0][0]; currentRow <= tileRange[0][1]; currentRow++)
		{
			for (var currentCol = tileRange[1][0]; currentCol <= tileRange[1][1]; currentCol++)
			{
				// If mine, add to the count of adjacent mines and then ignore the tile
				if (isMine(currentRow, currentCol))
				{
					adjMines++;
					continue;
				}

				// Ignore the central tile
				if ((row == currentRow && col == currentCol))
				{
					continue;
				}

				// Increase or decrease the number on the adjacent tile
				if (!recalc)
				{
					tiles[currentRow][currentCol].number++;
				}
				else
				{
					tiles[currentRow][currentCol].number--;
				}
			}
		}

		// If there is a mine within range, we need to add a number
		// where the mine was removed
		if (recalc)
		{
			tiles[row][col].number = adjMines;
		}
	}

	/**
	 * Generates a pseudo-random integer
	 *
	 * @param {int} min Minimum value (inclusive)
	 * @param {int} max Maximum value (inclusive)
	 * @return {int} Generated number
	 */
	function getRandomNumber(min, max)
	{
		return Math.floor(Math.random() * (max + 1 - min)) + min;
	}

	/**
	 * Provides range of tiles surrounding a specified tile
	 *
	 * @param {int} row Row of tile to use
	 * @param {int} col Column of file to use
	 * @return {array} List of surrounding tiles [[rowMin, rowMax], [colMin, colMax]]
	 */
	function getTileRange(row, col)
	{
		// Get surrounding tiles, within the board
		var rowMinBound = (row == 0) ? 0 : row - 1;
		var rowMaxBound = (row == boardHeight - 1) ? boardHeight - 1 : row + 1;
		var colMinBound = (col == 0) ? 0 : col - 1;
		var colMaxBound = (col == boardWidth - 1) ? boardWidth - 1 : col + 1;

		return [[rowMinBound, rowMaxBound], [colMinBound, colMaxBound]];
	}

	/*****************************************************
	 * Game Control
	 *****************************************************/

	/**
	 * Starts the game
	 *
	 * @return {undefined}
	 */
	function startGame()
	{
		if (gameWaiting)
		{
			gameWaiting = false;
			gameOver = false;
			timeStart();
		}
	}

	/**
	 * Ends the game
	 *
	 * @return {undefined}
	 */
	function endGame()
	{
		// If the game is active, stop the running timer
		gameOver = true;
		timeStop();
	}

	/**
	 * Ends the game with the user winning
	 *
	 * @return {undefined}
	 */
	function winGame()
	{
		// Smiley is very happy B)
		$(".smiley-icon").addClass("cool");

		// Play win sound, if enabled
		if (allowSound)
		{
			document.getElementById("snd_win").play();
		}

		// A new low time will trigger the name window
		if (difficulty < 3 && difficulty >= 0)
		{
			if (leaderboard[difficulty][1] > time)
			{
				// Update the text in the window
				var levelNames = ["beginner", "intermediate", "expert"];
				var highScoreMsgContainer = $("#ms-high-score #hs-description");
				var highScoreMsg = highScoreMsgContainer.data("hs-msg").replace("%LEVEL%", levelNames[difficulty]);
				highScoreMsgContainer.html(highScoreMsg);

				// Prepopulate the name field with the last name used for this level
				$("#ms-high-score #hs-name").val(leaderboard[difficulty][0]);

				// Display low time window
				var containerOffset = $(".minesweeper").offset();
				var statusOffset = $(".ms-status").offset().top + $(".ms-status").outerHeight();
				env.showWindow($("#ms-high-score"), containerOffset.left, statusOffset, $("#ms-main"));
				$("#ms-high-score #hs-name").select();
			}
		}

		// Game over!
		endGame();
	}

	/**
	 * Resets and starts the game time
	 *
	 * @return {undefined}
	 */
	function timeStart()
	{
		timeTick();
		timer = setInterval(function ()
		{
			timeTick();
		}, 1000);
	}

	/**
	 * Stops the game timer
	 *
	 * @return {undefined}
	 */
	function timeStop()
	{
		clearInterval(timer);
	}

	/**
	 * Increments the timer on tick
	 *
	 * @return {undefined}
	 */
	function timeTick()
	{
		if (timerEnabled)
		{
			// Do not exceed 999
			if (time < 999)
			{
				time++;
				digitRender("time", time);

				// Play tick sound, if enabled
				if (allowSound)
				{
					document.getElementById("snd_tick").play();
				}
			}
		}
	}

	/*****************************************************
	 * Leaderboard Control
	 *****************************************************/

	/**
	 * Updates the leaderboard
	 *
	 * @param {int}    level     Difficulty to update (0-2 valid)
	 * @param {string} name      Name of player
	 * @param {int}    timeTaken Time taken by player to complete game
	 * @param {bool}   skipSave  Do not save leaderboard information to local storage
	 * @return {undefined}
	 */
	function updateLeaderboard(level, name, timeTaken, skipSave)
	{
		if (level < 0 || level > 2 || timeTaken < 0 || timeTaken > 999)
		{
			return;
		}

		// Truncate name if longer than 32 characters
		name = name.substr(0, 32);

		// Update the leaderboard and save it
		leaderboard[level][0] = name;
		leaderboard[level][1] = timeTaken;

		if (!skipSave)
		{
			setLocalStorageValue("leaderboard", JSON.stringify(leaderboard));
		}

		// Update the leaderboard window
		var row = $("#ms-leaderboard .leader-container .row[data-leader-row=" + level + "]");
		var timeText = $("#ms-leaderboard .leader-container").data("time-string").replace('%TIME%', timeTaken);
		row.find(".time").first().html(timeText);
		row.find(".name").first().html(name);
	}

	/**
	 * Resets leaderboard scores to default
	 *
	 * @return {undefined}
	 */
	function resetLeaderboard()
	{
		for (var lvl = 0; lvl < 2; lvl++)
		{
			updateLeaderboard(lvl, "Anonymous", 999);
		}
	}

	/*****************************************************
	 * Local Storage Wrappers
	 *****************************************************/

	/**
	 * Retrieves data from local storage
	 *
	 * @param {string} key local storage key
	 * @return {object|null} The contents of local storage at the specified key, or null if there is no value for the key.
	 */
	 function getLocalStorageValue(key)
	 {
		 if (typeof window.localStorage != "undefined")
		 {
			 return window.localStorage.getItem(key);
		 }

		 return null;
	 }

	/**
	 * Inputs data into local storage
	 *
	 * @param {string} key local storage key
	 * @param {object} value value to set
	 * @return {undefined}
	*/
	function setLocalStorageValue(key, value)
	{
		if (typeof window.localStorage != "undefined")
		{
			window.localStorage.setItem(key, value);
		}
	}
})();
