/*
 * Minesweeper Classic, a Microsoft Minesweeper clone for the browser
 * Copyright (c) 2015 Brandon Dusseau
 * Licensed with the MIT license; see LICENSE file for details
 *
 * Some graphical assets copyright (c) 1981-2007 Microsoft Corporation
 *
 * http://www.github.com/BrandonDusseau/minesweeper-classic
 */

(function () {
	var timer        = null;  // Interval timer to handle clock
	var time         = 0;     // Time elapsed in game
	var gameWaiting  = true;  // Whether game is waiting to start
	var noMoves      = true;  // Whether no moves have been made yet
	var gameOver     = false; // Whether the game has ended (win or explode)
	var exploded     = false; // Whether the user has lost the game in a fiery explosion
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
	var customSet    = false; // Whether the board has custom dimensions set up
	var customWidth  = 0;     // Width of board on custom level
	var customHeight = 0;     // Height of board on custom level
	var customMines  = 0;     // Number of mines on board on custom level
	var firstGame    = true;  // Whether this is the first game (used for initialization)

	// Initialize the leaderboard
	var leaderboard = [
		["Anonymous", 999], // Beginner
		["Anonymous", 999], // Intermediate
		["Anonymous", 999]  // Expert
	];

	/**
	 * Tile object definition
	 */
	function Tile() {
		this.number = 0;
		this.isMine = false;
		this.flagged = false;
		this.marked = false;
		this.triggered = false;
		this.exploded = false;
	}

	// When the page has loaded, initialize the game
	$(document).ready(function () {
		// Handle global mouseup
		$("body").on('mouseup', function (e) {
			// Set smiley back to :)
			$(".smiley-icon").removeClass('active');

			// Reset mousedown triggers
			tileActive = false;
			groupActive = false;

			// If middle mouse is down, raise all down tiles
			$(".ms-panel.down").removeClass("down");
		});

		// Bind keys
		$("body").on('keydown', function (e) {
			// Bind keys to Minesweeper window
			if ($(".window#ms-main").hasClass('focused'))
			{
				// F2 - new game
				if (e.which == 113)
				{
					e.preventDefault();
					initGame(difficulty);
				}
				else if (e.which == 112)
				{
					e.preventDefault();
					// TODO
				}
			}
		});

		// Any click in the minesweeper space will trigger the active face
		$(".minesweeper").off('mousedown').on('mousedown', function (e) {
			if (!gameOver && (e.which == 1 || e.which == 2))
			{
				// Set smiley icon to 8O face
				$(".smiley-icon").addClass('active');
			}
		});

		// Smiley button click
		$(".smiley-btn").off('click').on('click', function(e) {
			// Reset the game at the current difficulty
			initGame(difficulty);
		});

		// New game menu option
		$("#game_new").on('click', function(e) {
			initGame(difficulty);
		});

		// Beginner menu option
		$("#game_beg:not(.disabled)").on('click', function(e) {
			setDifficulty(0);
		});

		// Intermediate menu option
		$("#game_int:not(.disabled)").on('click', function(e) {
			setDifficulty(1);
		});

		// Expert menu option
		$("#game_exp:not(.disabled)").on('click', function(e) {
			setDifficulty(2);
		});

		// Custom menu option
		$("#game_cst:not(.disabled)").on('click', function(e) {
			// TODO: Remove this and open a customization dialog
			setCustomBoard(16, 10, 15);
			setDifficulty(3);
		});

		// Enable/disabled mark tile menu option
		$("#game_mrk:not(.disabled)").on('click', function(e) {
			setMarks(!allowMarks);
		});

		// Enable/disable sound
		$("#game_snd:not(.disabled)").on('click', function(e) {
			setSound(!allowSound);
		});

		initGame(0);
	});

	/**
	 * Enables or disables sound
	 * @param boolean enabled True to enable, false to disable
	 * @param boolean skipCookie If true, do not set cookie
	 * @return undefined
	 */
	function setSound(enabled, skipCookie)
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

		// Write preference to cookie if enabled
		if (!skipCookie)
		{
			setCookie("SWEEP_SND", allowSound ? 1 : 0, 365);
		}
	}

	/**
	 * Enables or disables marks (?)
	 * @param boolean enabled True to enable, false to disable
	 * @param boolean skipCookie If true, do not set cookie
	 * @return undefined
	 */
	function setMarks(enabled, skipCookie)
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

		// Write preference to cookie if enabled
		if (!skipCookie)
		{
			setCookie("SWEEP_MRK", allowMarks ? 1 : 0, 365);
		}
	}

	/**
	 * Sets the difficulty level
	 * @param int diff level
	 * @param boolean skipCookie If true, do not set cookie
	 * @return undefined
	 */
	function setDifficulty(diff, skipCookie)
	{
		// Only accept valid levels
		if (diff < 0 || diff > 3)
		{
			return;
		}

		// Adjust the context menu entries
		var lvl = ["beg", "int", "exp", "cst"];
		for (var i = 0; i < lvl.length; i++)
		{
			var element = $("#game_" + lvl[i]);
			if (i == diff)
			{
				element.addClass("checked");
			}
			else
			{
				element.removeClass("checked");
			}
		}

		// Write preference to cookie if enabled
		if (!skipCookie)
		{
			setCookie("SWEEP_LVL", diff, 365);
		}

		// Apply the setting
		initGame(diff);
	}

	/**
	 * Sets up custom board dimensions
	 * @param int width Width of board
	 * @param int heightHeight of board
	 * @param int mines Number of mines to place
	 * @param boolean skipCookie If true, do not set cookie
	 * @return undefined
	 */
	function setCustomBoard(width, height, mines, skipCookie)
	{
		// Override invalid board preferences
		// Width must be between 9 and 30, inclusive
		width = (width > 30 ? 30 : width);
		width = (width < 9 ? 9 : width);

		// Height must be between 9 and 24, inclusive
		height = (height > 24 ? 24 : height);
		height = (height < 9 ? 9 : height);

		// Mines must be between 10 and (x-1)(y-1), inclusive
		mines = (mines < 10 ? 10 : mines);
		var minesAllowed = (height - 1) * (width - 1);
		mines = (mines > minesAllowed ? minesAllowed : mines);

		// Update the game state
		customSet = true;
		customWidth = width;
		customHeight = height;
		customMines = mines;

		// Write preference to cookie if enabled
		if (!skipCookie)
		{
			setCookie("SWEEP_WIDTH", width, 365);
			setCookie("SWEEP_HEIGHT", height, 365);
			setCookie("SWEEP_MINES", mines, 365);
		}
	}

	/**
	 * Binds events to elements which might be regenerated
	 * This must happen every time the game is initialized to ensure bindings don't get lost
	 * @return undefined
	 */
	function rebindEvents()
	{
		// Block context menu on windows
		$(".window *").off('contextmenu').on('contextmenu', function(e) {
			e.preventDefault();
		});

		// Handle mousedown on a mine panel
		$(".ms-panel").off('mousedown').on('mousedown', function (e) {
			// Left mouse button when game has not ended and panel is not triggered
			if (!gameOver)
			{
				switch (e.which)
				{
					case 1:
						// Left mouse press
						tileActive = true;
						$(this).trigger('mouseenter');
						break;
					case 2:
						// Middle mouse press
						groupActive = true;
						$(this).trigger('mouseenter');
						break;
					case 3:
						// Right mouse press - forward the event to the click handler
						var target = $(this);
						handlePanelClick(target, e);
						break;
				}
			}
		});

		// Handle mouseenter on a mine panel (if the mouse button was clicked)
		$(".ms-panel").off('mousenter').on('mouseenter', function (e) {
			if (tileActive && !$(this).hasClass("flagged"))
			{
				// Apply the down action
				$(this).addClass("down");
			}
			else if (groupActive)
			{
				// Apply the down action on element and all surrounding it
				var coords = getCoords($(this));
				var tileRange = getTileRange(coords[0], coords[1]);

				for (var i = tileRange[0][0]; i <= tileRange[0][1]; i++)
				{
					for (var j = tileRange[1][0]; j <= tileRange[1][1]; j++)
					{
						if (!isFlagged(i,j))
						{
							$(".ms-panel[data-coord=\"" + i + "," + j +"\"]").addClass("down");
						}
					}
				}
			}
		});

		// Handle mouseup on a mine panel
		$(".ms-panel").off('mouseleave').on('mouseleave', function (e) {
			// Left or middle mouse button will cuase all downed tiles to reset
			if (e.which == 1 || e.which == 2)
			{
				// Remove the down class
				$(".ms-panel.down").removeClass("down");
			}
		});

		// Handle mouseup on mine panel
		$(".ms-panel").off('mouseup').on('mouseup', function(e) {
			if ((tileActive || groupActive) && !gameOver)
			{
				// If game hasn't started yet, start it!
				if (gameWaiting)
				{
					startGame();
				}

				var target = $(this);
				handlePanelClick(target, e);

				// Trigger the body mouseup event because propagation was stopped
				$('body').trigger('mouseup');
			}
		});
	}

	/**
	 * Handles clicks for ms-panel elements
	 * @param jquery target The element attached to the event
	 * @param event ev Event properties
	 * @return undefined
	 */
	function handlePanelClick(target, ev)
	{
		ev.stopPropagation();

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
			$(".smiley-icon").removeClass('active');
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
			for (var i = tileRange[0][0]; i <= tileRange[0][1]; i++)
			{
				for (var j = tileRange[1][0]; j <= tileRange[1][1]; j++)
				{
					// Skip the clicked tile
					if (i == row && j == col)
					{
						continue;
					}

					// If tile is flagged, subtract from number of flags left
					if (isFlagged(i, j))
					{
						flagsLeft--;
					}
					// Otherwise, add to the trigger queue
					else
					{
						triggerQueue.push([i, j]);
					}
				}
			}

			// If there are the wrong number of flags, abort!
			if (flagsLeft !== 0)
			{
				return;
			}

			// Reorder the trigger queue to put mines last
			// This guarantees that non-mine tiles will trigger before
			// a game-ending explosion.
			var tilesInQueue = triggerQueue.length;
			for (var i = 0; i < tilesInQueue; i++)
			{
				var qRow = triggerQueue[i][0];
				var qCol = triggerQueue[i][1];

				if (isMine(qRow, qCol))
				{
					triggerQueue.splice(i, 1);
					triggerQueue.push([qRow, qCol]);

					// Shorten the array and rewind
					tilesInQueue--;
					i--;
				}
			}

			// Trigger the mines--err.. tiles. >:)
			for (var i = 0; i < triggerQueue.length; i++)
			{
				var qRow = triggerQueue[i][0];
				var qCol = triggerQueue[i][1];
				trigger(qRow, qCol);
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

	/**
	 * Gets coordinates of a mine panel
	 * @param jquery target Element from which to get coordinates
	 * @return array Coordinates of tile [y,x]
	 */
	function getCoords(target)
	{
		var coords = target.data("coord").split(",");
		return [parseInt(coords[0], 10), parseInt(coords[1], 10)];
	}

	/**
	 * Flags a tile
	 * @param int row Row to set
	 * @param int col Column to set
	 * @return undefined
	 */
	function flag(row, col) {
		var tile = tiles[row][col];

		// Tile may only be flagged if it is fresh
		if (!gameOver && !tile.triggered && !tile.marked) {
			tiles[row][col].flagged = true;
		}

		// Rerender the tile in its new state
		rerender(row, col);
	}

	/**
	 * Marks a tile ("?")
	 * @param int row Row to set
	 * @param int col Column to set
	 * @return undefined
	 */
	function mark(row, col) {
		var tile = tiles[row][col];

		// Tile may only be marked if it is untriggered and flagged
		if (!gameOver && !tile.triggered && tile.flagged) {
			tile.flagged = false;
			tile.marked = true;
		}

		// Save the tile and rerender it
		tiles[row][col] = tile;
		rerender(row, col);
	}

	/**
	 * Clears marked and flagged statuses on a tile
	 * @param int row Row to set
	 * @param int col Column to set
	 * @return undefined
	 */
	function clear(row, col) {
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
	 * Triggers a tile
	 * @param int row Row to trigger
	 * @param int col Column to trigger
	 * @return undefined
	 */
	function trigger(row, col) {
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
			placeMine(row, col)
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
	 * @param int row Row subcoord for tile to check
	 * @param int col Column subcoord for tile to check
	 * @return undefined
	 */
	function cascadeTrigger(row, col)
	{
		// Do not allow checks outside the board
		var rowMinBound = (row == 0) ? 0 : row - 1;
		var rowMaxBound = (row == boardHeight - 1) ? boardHeight - 1 : row + 1;
		var colMinBound = (col == 0) ? 0 : col - 1;
		var colMaxBound = (col == boardWidth - 1) ? boardWidth - 1 : col + 1;

		// Loop through up to nine tiles
		for (var i = rowMinBound; i <= rowMaxBound; i++)
		{
			for (var j = colMinBound; j <= colMaxBound; j++)
			{
				// Trigger tile if it is a number or is not a mine or flagged
				var tile = tiles[i][j];
				if (tile.number > 0 || (!tile.isMine && !tile.flagged))
				{
					trigger(i, j);
				}
			}
		}
	}

	/**
	 * Sets a tile as a mine
	 * @param int row Row to set
	 * @param int col Column to set
	 * @return undefined
	 */
	function mine(i, j) {
		tiles[i][j].isMine = true;
	}

	/**
	 * Detonates a mine (boom)
	 * @param int row Row to explode
	 * @param int col Column on which to make blam
	 * @return undefined
	 */
	function explode(i, j)
	{
		var tile = tiles[i][j];

		// Sanity check - only mines explode!
		if (!tile.isMine)
		{
			return;
		}

		// Mark tile as exploded
		tile.exploded = true;
		tiles[i][j] = tile;

		// Play explosion sound, if enabled
		if (allowSound)
		{
			document.getElementById("snd_explode").play();
		}

		// End the game!
		endGame();

		// Reveal mine tiles and incorrect flags, and leave good flags alone
		for (var i = 0; i < boardHeight; i++)
		{
			for (var j = 0; j < boardWidth; j++)
			{
				var tileToTrigger = tiles[i][j];
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
					tiles[i][j] = tileToTrigger;
					rerender(i, j);
				}
			}
		}

		// Murder the smiley :(
		$(".smiley-icon").addClass('dead');
	}

	/**
	 * Checks whether a tile is triggered
	 * @param int row Row to check
	 * @param int col Column to check
	 * @return boolean True if tile is triggered, false otherwise
	 */
	function isTriggered(i, j)
	{
		return tiles[i][j].triggered;
	}

	/**
	 * Checks whether a tile is fresh
	 * @param int row Row to check
	 * @param int col Column to check
	 * @return boolean True if tile is fresh, false otherwise
	 */
	function isClear(i, j)
	{
		var tile = tiles[i][j];

		// Tile is fresh if not triggered, marked, or flagged
		return !tile.triggered && !tile.marked && !tile.flagged;
	}

	/**
	 * Checks whether a tile is a number
	 * @param int row Row to check
	 * @param int col Column to check
	 * @return boolean True if tile is a number, false otherwise
	 */
	function isNumber(i, j)
	{
		return tiles[i][j].number != 0;
	}

	/**
	 * Checks whether a tile is marked
	 * @param int row Row to check
	 * @param int col Column to check
	 * @return boolean True if tile is marked, false otherwise
	 */
	function isMarked(i, j)
	{
		return tiles[i][j].marked;
	}

	/**
	 * Checks whether a tile is flagged
	 * @param int row Row to check
	 * @param int col Column to check
	 * @return boolean True if tile is flagged, false otherwise
	 */
	function isFlagged(i, j)
	{
		return tiles[i][j].flagged;
	}

	/**
	 * Checks whether a tile is a mine
	 * @param int row Row to check
	 * @param int col Column to check
	 * @return boolean True if tile is a mine, false otherwise
	 */
	function isMine(i, j)
	{
		return tiles[i][j].isMine;
	}

	/**
	 * Returns the number of a tile
	 * @param int row Row to check
	 * @param int col Column to check
	 * @return int Number of tile
	 */
	function getNumber(i, j)
	{
		return tiles[i][j].number;
	}

	/**
	 * Renders a tile in its current internal state
	 * @param int row Row to render
	 * @param int col Column to render
	 * @return undefined
	 */
	function rerender(i, j)
	{
		// Locate the target in the DOM and load its metadata
		var target = $(".ms-panel[data-coord=\"" + i + "," + j +"\"]");
		var tile = tiles[i][j];

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
				target.addClass("bogus")
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
	 * Resets and starts the game time
	 * @return undefined
	 */
	function timeStart()
	{
		timeTick();
		timer = setInterval(function() {timeTick()}, 1000);
	};

	/**
	 * Stops the game timer
	 * @return undefined
	 */
	function timeStop()
	{
		clearInterval(timer);
	}

	/**
	 * Increments the timer on tick
	 * @return undefined
	 */
	function timeTick()
	{
		// Do not exceed 999
		if (time < 999)
		{
			time++;
			digitRender('time', time);

			// Play tick sound, if enabled
			if (allowSound)
			{
				document.getElementById("snd_tick").play();
			}
		}
	}

	/**
	 * Adds a mine to the mine counter
	 * @return undefined
	 */
	function addMine()
	{
		if (minesLeft < maxMines)
		{
			minesLeft++;
			digitRender('mines', minesLeft);
		}
	}

	/**
	 * Removes a mine from the mine counter
	 * @return undefined
	 */
	function subMine()
	{
		if (minesLeft > -99)
		{
			minesLeft--;

			// Render the count or -99 if it's too low
			digitRender('mines', (minesLeft > -100) ? minesLeft : -99);
		}
	}

	/**
	 * Renders digits on the digital number boxes
	 * @param string target ID of the element to render (must be num-box class)
	 * @param int number Number to render on the display
	 * @return undefined
	 */
	function digitRender(target, number)
	{
		target = '.num-box#' + target;

		// Determine each digit of the display
		num = Math.abs(number);
		var hundreds = Math.floor(num / 100);
		num -= hundreds * 100;
		var tens = Math.floor(num / 10);
		num -= tens * 10;

		// Make hundreds place a hyphen if negative
		if (number < 0)
		{
			hundreds = 'n';
		}

		// Set the display
		$(target + ' .digit').removeClass('d0 d1 d2 d3 d4 d5 d6 d7 d8 d9 dn');
		$(target + ' .digit.iii').addClass('d' + hundreds);
		$(target + ' .digit.ii').addClass('d' + tens);
		$(target + ' .digit.i').addClass('d' + num);
	}

	/**
	 * Initializes the game
	 * @param int diff Difficulty of the game - see def at top of file for details
	 * @param int width Optional board width specification (diff = 3)
	 * @param int height Optional board height specification (diff = 3)
	 * @param int mines Optional number of mines specification (diff = 3)
	 * @return undefined
	 */
	function initGame(diff)
	{
		// Reset the game state
		endGame();
		gameWaiting = true;
		gameOver = false;
		noMoves = true;

		// If custom settings are not set, override custom difficulty
		// Also do this if the difficulty setting is invalid
		if (diff < 0 || diff > 3 || (diff == 3 && !customSet))
		{
			diff = 0;
		}

		// Set up defaults based on difficulty level, unless using a custom setting
		var defaults = {
			'width': [9,16,30],
			'height': [9,16,16],
			'mines': [10,40,99]
		};

		// Set defaults if using a non-custom difficulty
		if (diff != 3)
		{
			var width = defaults.width[diff];
			var height = defaults.height[diff];
			var mines = defaults.mines[diff];
		}
		else
		{
			var width = customWidth;
			var height = customHeight;
			var mines = customMines;
		}

		// Set up initial game data
		maxMines = mines;
		minesLeft = mines;
		boardWidth = width;
		boardHeight = height;
		difficulty = diff;
		exploded = false;
		time = 0;
		tiles = [];
		tilesLeft = (width * height) - mines;

		// On first game, initialize some preferences
		if (firstGame)
		{
			firstGame = false;

			// Load the leaderboard from cookie, if available
			leaderboard = getCookie("SWEEP_TOP");
			try
			{
				if (leaderboard !== "")
				{
					leaderboard = $.parseJSON(leaderboard);
				}
			}
			catch (e)
			{
				// Silently reset if the cookie is malformed
				console.log("Error: leaderboard data is corrupt. Resetting to default...");
				setCookie("SWEEP_TOP", leaderboard, 365);
			}

			// Restore sound preference
			var sndPref = getCookie("SWEEP_SND");
			if (sndPref !== "")
			{
				setSound(sndPref, true);
			}

			// Restore marks preference
			var mrkPref = getCookie("SWEEP_MRK");
			if (mrkPref !== "")
			{
				setMarks(mrkPref, true);
			}

			// Restore level preference
			// This must be last because it may reinitialize the game board
			var lvlPref = getCookie("SWEEP_LVL");
			var bwPref = getCookie("SWEEP_WIDTH");
			var bhPref = getCookie("SWEEP_HEIGHT");
			var bmPref = getCookie("SWEEP_MINES");
			if (lvlPref !== "")
			{
				// Don't restore the preference if custom has invalid bounds
				if (lvlPref != 3 || (bwPref !== "" && bhPref !== "" && bmPref !== ""))
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
		digitRender('time', time);
		digitRender('mines', minesLeft);

		// Reset the smiley icon :)
		$(".smiley-icon").removeClass("active cool dead");

		// Bind event handlers
		rebindEvents();

		// Display the window if it was hidden
		$('.window#ms-main').css('display', 'inline-block');
	}

	/**
	 * Generates game grid in memory and then renders the displayed grid
	 * @return undefined
	 */
	function generateGrid()
	{
		var grid = "";
		// Cycle through rows (ms-row)
		for (var i = 0; i < boardHeight; i++)
		{
			// Create array for each row
			tiles.push([]);
			grid += "<div class='ms-row'>"

			// Cycle through each tile in the row
			for (var j = 0; j < boardWidth; j++)
			{
				// Add the default object to the game array
				tiles[i].push(new Tile());
				grid += "<div class='ms-panel' data-coord='" + i + "," + j + "'></div>";
			}

			grid += "</div>"
		}

		// Place the appropriate number of mines
		var mineNum = maxMines;
		while (mineNum--)
		{
			placeMine();
		}

		// Render the grid
		$('.ms-grid').html(grid);
	}

	/**
	 * Places a mine in a random location on the grid
	 * @param int exclRow Optional row to exclude from mine
	 * @param int exclCol Optional column to exclude from mine
	 * @return undefined
	 */
	function placeMine(exclRow, exclCol)
	{
		// Disable exclusion check if coordinate not provided
		var excl = typeof exclRow != 'undefined';

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
	 * @param int row Row subcoord for center tile
	 * @param int col Column subcoord for center tile
	 * @param boolean reduce Optional - reduces numbers instead
	 * @return undefined
	 */
	function setNumbers(row, col, recalc)
	{
		// Loop through up to nine tiles
		var tileRange = getTileRange(row, col);
		var adjMines = 0;
		for (var i = tileRange[0][0]; i <= tileRange[0][1]; i++)
		{
			for (var j = tileRange[1][0]; j <= tileRange[1][1]; j++)
			{
				// If mine, add to the count of adjacent mines and then ignore the tile
				if (isMine(i,j))
				{
					adjMines++;
					continue;
				}

				// Ignore the central tile
				if ((row == i && col == j))
				{
					continue;
				}

				// Increase or decrease the number on the adjacent tile
				if (!recalc)
				{
					tiles[i][j].number++;
				}
				else
				{
					tiles[i][j].number--;
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
	 * @param int min Minimum value (inclusive)
	 * @param int max Maximum value (inclusive)
	 * @return int Generated number
	 */
	function getRandomNumber(min, max)
	{
		return Math.floor(Math.random() * (max + 1 - min)) + min;
	}

	/**
	 * Provides range of tiles surrounding a specified tile
	 * @param int row Row of tile to use
	 * @param int col Column of file to use
	 * @return array List of surrounding tiles [[rowMin, rowMax], [colMin, colMax]]
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

	/**
	 * Determines whether game is running
	 * @return boolean True if game is active
	 */
	function isGameRunning()
	{
		return !gameWaiting && !gameOver;
	}

	/**
	 * Starts the game
	 * @return undefined
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
	 * @return undefined
	 */
	function endGame()
	{
		// If the game is active, stop the running timer
			gameOver = true;
			timeStop();
	}

	/**
	 * Ends the game with the user winning
	 * @return undefined
	 */
	function winGame()
	{
		// Smiley is very happy B)
		$(".smiley-icon").addClass('cool');

		// Play win sound, if enabled
		if (allowSound)
		{
			document.getElementById("snd_win").play();
		}

		// Update the leaderboard if the score is better
		if (difficulty < 3 && difficulty >= 0)
		{
			if (leaderboard[difficulty][1] < time)
			{
				leaderboard[difficulty][1] = time;
				setCookie("SWEEP_TOP", JSON.stringify(leaderboard), 365);
			}
		}

		// Game over!
		endGame();
	}

	/**
	 * Sets a cookie
	 * @param string name Name of cookie
	 * @param string value Value of cookie
	 * @param int expiry Expiration in days
	 * @return undefined
	 */
	function setCookie(name, value, expiry)
	{
		// Convert days to ms
		expiry *= 86400000;
    var expDate = new Date(Date.now() + expiry);
    var expires = "expires=" + expDate.toUTCString();
    document.cookie = name + "=" + value + "; " + expires;
	}

	/**
	 * Gets the value of a cookie
	 * @param string name Name of cookie
	 * @return string Cookie value
	 */
	function getCookie(name)
	{
		name = name + "=";
		var cookieList = document.cookie.split(';');
		for (var i = 0; i < cookieList.length; i++) {
			var cookie = cookieList[i];

			while (cookie.charAt(0) == ' ')
			{
				cookie = cookie.substring(1);
			}

			if (cookie.indexOf(name) == 0)
				{
					return cookie.substring(name.length,cookie.length);
				}
		}
		return "";
	}
})();
