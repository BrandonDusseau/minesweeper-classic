(function () {
	var timer       = null;  // Interval timer to handle clock
	var time        = 0;     // Time elapsed in game
	var gameWaiting = true;  // Whether game is waiting for the first move
	var gameOver    = false; // Whether the game has ended (win or explode)
	var exploded    = false; // Whether the user has lost the game in a fiery explosion
	var minesLeft   = 0;     // Number of mines unflagged. from the user perspective
	var maxMines    = 0;     // Number of mines in the game
	var difficulty  = 0;     // Difficulty level. 0 = Beginner, 1 = Interm., 2 = Expert, 3 = Custom
	var boardWidth  = 0;     // Number of tiles across the board
	var boardHeight = 0;     // Number of tiles down the board
	var tiles       = null;  // Array of game tiles ([row][column])
	var tilesLeft   = 0;     // Number of uncovered tiles left, excluding mines

	var debugdiff = 0;

	/**
	 * Tile object
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
		initGame(0);
	});

	/**
	 * Binds events to elements on the page
	 * This must happen every time the game is initialized to ensure bindings don't get lost
	 * @return undefined
	 */
	function rebindEvents()
	{
		// Block context menu on windows
		$(".window *").off('contextmenu').on('contextmenu', function(e) {
			e.preventDefault();

			// Forward the event to the click handler
			var target = $(this);
			handlePanelClick(target, e);
		});

		// Handle mousedown on a mine panel
		$(".ms-panel").off('mousedown').on('mousedown', function (e) {
			// Left mouse button when game has not ended and panel is not triggered
			if (e.which == 1 && !gameOver && !$(this).hasClass("triggered") && !$(this).hasClass("flagged"))
			{
				// Apply the down action
				$(this).addClass("down");

				// Set smiley icon to 8O face
				$(".smiley-icon").addClass('active');
			}
		});

		// Handle mouseup on a mine panel
		$(".ms-panel").off('mouseup').on('mouseup', function (e) {
			// Left mouse button when game has not ended and panel is not triggered
			if (e.which == 1 && !$(this).hasClass("triggered"))
			{
				// Remove the down class
				$(this).removeClass("down");

				if (!gameOver)
				{
					// Set smiley back to :)
					$(".smiley-icon").removeClass('active');
				}
			}
		});

		// Handle click on mine panel
		$(".ms-panel").off('click').on('click', function(e) {
			var target = $(this);
			handlePanelClick(target, e);
		});

		// Game menu click
		$("#menu-game").off('click').on('click', function(e) {
			initGame(++debugdiff % 3);
		});

		// Smiley button click
		$(".smiley-btn").off('click').on('click', function(e) {
			// Reset the game at the current difficulty
			initGame(difficulty);
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
			// If the game hasn't ended, trigger the tile
			if (!gameOver && !isTriggered(row, col))
			{
				trigger(row, col);
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
				// If tile is flagged, mark it instead
				else if (isFlagged(row, col))
				{
					mark(row, col);
					addMine();
				}
				// Tile must be marked, so clear it
				else
				{
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

		// If game hasn't started yet, start it!
		if (gameWaiting)
		{
			startGame();
		}

		// Save the tile
		tiles[row][col] = tile;

		// Mine explodes if triggered during game
		if (!gameWaiting && tile.isMine)
		{
			explode(row, col);

			// Bail out - rendering will happen post-game
			return;
		}
		// Mine must be relocated if this is the first click
		else if (gameWaiting && tile.isMine)
		{
			// Disable this mine and recalculate the numbers around it
			tiles[row][col].isMine = false;
			setNumbers(row, col, true);

			// Place a new mine with this tile excluded
			placeMine(row, col)
		}

		// Rerender the tile
		rerender(row, col);

		// Mark the game as active
		gameWaiting = false;

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
				var tile = tiles[row][col];
				// Trigger tile if it is a number or is not a mine or flagged
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
		time = 0;
		digitRender('time', 0);
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
	function initGame(diff, width, height, mines)
	{
		// Reset the game state
		endGame();
		gameWaiting = true;
		gameOver = false;

		// Set up defaults based on difficulty level, unless using a custom setting
		var defaults = {
			'width': [9,16,30],
			'height': [9,16,16],
			'mines': [10,40,99]
		};

		// Set defaults if using a built-in difficulty
		if (diff >= 0 || diff <= 2)
		{
			width = defaults.width[diff];
			height = defaults.height[diff];
			mines = defaults.mines[diff];
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
	function setNumbers(row, col, reduce)
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
				// Ignore the central tile and any mines
				if ((row == i && col == j) || isMine(i,j))
				{
					continue;
				}

				// Increase or decrease the number on the adjacent tile
				if (!reduce)
				{
					tiles[i][j].number++;
				}
				else
				{
					tiles[i][j].number--;
				}
			}
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
		if (isGameRunning())
		{
			gameOver = true;
			timeStop();
		}
	}

	/**
	 * Ends the game with the user winning
	 * @return undefined
	 */
	function winGame()
	{
		// Smiley is very happy B)
		$(".smiley-icon").addClass('cool');
		endGame();
	}
})();
