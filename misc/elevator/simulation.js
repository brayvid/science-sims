// ==============================================================================
// DOMAIN MODEL (Pure JavaScript Port of Java Architecture)
// ==============================================================================

const Direction = Object.freeze({
    IDLE: 'IDLE',
    UP: 'UP',
    DOWN: 'DOWN'
});

class FloorRequest {
    constructor(floorNumber, direction) {
        this.floorNumber = floorNumber;
        this.direction = direction;
    }
    equals(other) {
        return other && this.floorNumber === other.floorNumber && this.direction === other.direction;
    }
}

class Button {
    constructor() { this.pressed = false; }
    push() { this.pressed = true; }
    reset() { this.pressed = false; }
    isPressed() { return this.pressed; }
}

class UpDownButton extends Button {
    constructor(direction, floor) {
        super();
        this.direction = direction;
        this.floor = floor;
    }
}

class DestButton extends Button {
    constructor(floorNumber, elevator) {
        super();
        this.floorNumber = floorNumber;
        this.elevator = elevator;
    }
}

class Floor {
    constructor(floorNumber, building) {
        this.floorNumber = floorNumber;
        this.building = building;
        this.waiting = [];
    }
    addRiderWaiting(rider) {
        if (!this.waiting.includes(rider)) this.waiting.push(rider);
    }
    removeRiderWaiting(rider) {
        const idx = this.waiting.indexOf(rider);
        if (idx !== -1) this.waiting.splice(idx, 1);
    }
    pressUpButton() {}
    pressDownButton() {}
    isUpButtonPressed() { return false; }
    isDownButtonPressed() { return false; }
    resetUpButton() {}
    resetDownButton() {}
}

class Lobby extends Floor {
    constructor(floorNumber, building) {
        super(floorNumber, building);
        this.upButton = new UpDownButton(Direction.UP, this);
    }
    pressUpButton() {
        this.upButton.push();
        this.building.addFloorRequest(this.floorNumber, Direction.UP);
    }
    isUpButtonPressed() { return this.upButton.isPressed(); }
    resetUpButton() { this.upButton.reset(); }
}

class MiddleFloor extends Floor {
    constructor(floorNumber, building) {
        super(floorNumber, building);
        this.upButton = new UpDownButton(Direction.UP, this);
        this.downButton = new UpDownButton(Direction.DOWN, this);
    }
    pressUpButton() {
        this.upButton.push();
        this.building.addFloorRequest(this.floorNumber, Direction.UP);
    }
    pressDownButton() {
        this.downButton.push();
        this.building.addFloorRequest(this.floorNumber, Direction.DOWN);
    }
    isUpButtonPressed() { return this.upButton.isPressed(); }
    isDownButtonPressed() { return this.downButton.isPressed(); }
    resetUpButton() { this.upButton.reset(); }
    resetDownButton() { this.downButton.reset(); }
}

class Roof extends Floor {
    constructor(floorNumber, building) {
        super(floorNumber, building);
        this.downButton = new UpDownButton(Direction.DOWN, this);
    }
    pressDownButton() {
        this.downButton.push();
        this.building.addFloorRequest(this.floorNumber, Direction.DOWN);
    }
    isDownButtonPressed() { return this.downButton.isPressed(); }
    resetDownButton() { this.downButton.reset(); }
}

let nextRiderId = 1;

class Rider {
    constructor(building, originFloorNum, intendedDirection, weight) {
        this.id = nextRiderId++;
        this.weight = weight;
        this.currentFloorNum = originFloorNum;
        this.intendedDirection = intendedDirection;
        this.destFloorNum = intendedDirection === Direction.UP ? originFloorNum + 1 : originFloorNum - 1;
        this.building = building;
        this.elevator = null;

        building.getFloor(this.currentFloorNum).addRiderWaiting(this);
        building.addOccupant(this);
    }

    requestElevator() {
        if (this.elevator !== null) return;
        const floorObj = this.building.getFloor(this.currentFloorNum);
        if (this.intendedDirection === Direction.UP) {
            floorObj.pressUpButton();
        } else {
            floorObj.pressDownButton();
        }
    }

    enter(elevatorObj) {
        this.building.getFloor(this.currentFloorNum).removeRiderWaiting(this);
        elevatorObj.occupants.push(this);
        this.elevator = elevatorObj;
        elevatorObj.currentWeight += this.weight;
    }

    exitElev(elevatorObj) {
        const target = elevatorObj || this.elevator;
        if (!target) return;

        const idx = target.occupants.indexOf(this);
        if (idx !== -1) target.occupants.splice(idx, 1);

        this.currentFloorNum = target.currentFloor;
        if (this.currentFloorNum !== this.destFloorNum) {
            this.building.getFloor(this.currentFloorNum).addRiderWaiting(this);
        }

        target.currentWeight -= this.weight;
        this.elevator = null;
    }
}

class Elevator {
    constructor(building, id, weightLimit = 2000) {
        this.DOOR_OPEN_DURATION = 2;
        this.building = building;
        this.id = id;
        this.weightLimit = weightLimit;
        this.currentFloor = 0;
        this.currentWeight = 0;
        this.occupants = [];
        this.direction = Direction.IDLE;
        this.destinationRequests = new Set();
        this.pickupRequests = [];
        this.buttons = [];
        for (let i = 0; i < building.numFloors; i++) {
            this.buttons.push(new DestButton(i, this));
        }
        this.doorsOpen = false;
        this.doorTimer = 0;
    }

    pressDestinationButton(floorNumber) {
        if (floorNumber >= 0 && floorNumber < this.building.numFloors) {
            this.buttons[floorNumber].push();
            if (floorNumber !== this.currentFloor) {
                this.destinationRequests.add(floorNumber);
            }
        }
    }

    assignPickupRequest(floorNumber, direction) {
        const exists = this.pickupRequests.some(r => r.floorNumber === floorNumber && r.direction === direction);
        if (!exists) {
            this.pickupRequests.push(new FloorRequest(floorNumber, direction));
        }
    }

    hasDestinationsAbove() {
        for (let f of this.destinationRequests) {
            if (f > this.currentFloor) return true;
        }
        return false;
    }

    hasDestinationsBelow() {
        for (let f of this.destinationRequests) {
            if (f < this.currentFloor) return true;
        }
        return false;
    }

    hasRequestsAbove() {
        if (this.hasDestinationsAbove()) return true;
        return this.pickupRequests.some(r => r.floorNumber > this.currentFloor);
    }

    hasRequestsBelow() {
        if (this.hasDestinationsBelow()) return true;
        return this.pickupRequests.some(r => r.floorNumber < this.currentFloor);
    }

    getAllStops() {
        const stops = new Set(this.destinationRequests);
        for (let r of this.pickupRequests) stops.add(r.floorNumber);
        return Array.from(stops);
    }

    getNextTargetFloor() {
        if (this.destinationRequests.size === 0 && this.pickupRequests.length === 0) {
            return null;
        }

        if (this.direction === Direction.UP) {
            const validStopsAbove = [];
            for (let f of this.destinationRequests) {
                if (f >= this.currentFloor) validStopsAbove.push(f);
            }
            for (let r of this.pickupRequests) {
                if (r.floorNumber >= this.currentFloor && r.direction === Direction.UP) {
                    validStopsAbove.push(r.floorNumber);
                }
            }

            if (!this.hasDestinationsAbove()) {
                let highestDown = -1;
                for (let r of this.pickupRequests) {
                    if (r.direction === Direction.DOWN && r.floorNumber > highestDown) {
                        highestDown = r.floorNumber;
                    }
                }
                if (highestDown >= this.currentFloor) {
                    const hasUpAbove = this.pickupRequests.some(r => r.direction === Direction.UP && r.floorNumber > highestDown);
                    if (!hasUpAbove) validStopsAbove.push(highestDown);
                }
            }

            if (validStopsAbove.length > 0) return Math.min(...validStopsAbove);
            const allStops = this.getAllStops();
            return allStops.length > 0 ? Math.min(...allStops) : null;

        } else if (this.direction === Direction.DOWN) {
            const validStopsBelow = [];
            for (let f of this.destinationRequests) {
                if (f <= this.currentFloor) validStopsBelow.push(f);
            }
            for (let r of this.pickupRequests) {
                if (r.floorNumber <= this.currentFloor && r.direction === Direction.DOWN) {
                    validStopsBelow.push(r.floorNumber);
                }
            }

            if (!this.hasDestinationsBelow()) {
                let lowestUp = this.building.numFloors + 1;
                for (let r of this.pickupRequests) {
                    if (r.direction === Direction.UP && r.floorNumber < lowestUp) {
                        lowestUp = r.floorNumber;
                    }
                }
                if (lowestUp <= this.currentFloor) {
                    const hasDownBelow = this.pickupRequests.some(r => r.direction === Direction.DOWN && r.floorNumber < lowestUp);
                    if (!hasDownBelow) validStopsBelow.push(lowestUp);
                }
            }

            if (validStopsBelow.length > 0) return Math.max(...validStopsBelow);
            const allStops = this.getAllStops();
            return allStops.length > 0 ? Math.max(...allStops) : null;

        } else { // IDLE
            const allStops = this.getAllStops();
            if (allStops.length === 0) return null;

            let closest = null;
            let minDist = this.building.numFloors + 1;
            for (let floor of allStops) {
                const dist = Math.abs(floor - this.currentFloor);
                if (dist < minDist || (dist === minDist && floor === this.currentFloor)) {
                    minDist = dist;
                    closest = floor;
                }
            }
            return closest;
        }
    }

    canRiderBoard(riderReqDir) {
        if (this.direction === Direction.IDLE) return true;
        if (this.direction === Direction.UP) {
            if (riderReqDir === Direction.UP) return true;
            if (riderReqDir === Direction.DOWN) return !this.hasRequestsAbove();
        }
        if (this.direction === Direction.DOWN) {
            if (riderReqDir === Direction.DOWN) return true;
            if (riderReqDir === Direction.UP) return !this.hasRequestsBelow();
        }
        return false;
    }

    shouldStopAtCurrentFloor() {
        if (this.destinationRequests.has(this.currentFloor)) return true;
        if (this.pickupRequests.length === 0) return false;

        const target = this.getNextTargetFloor();
        if (target !== null && target === this.currentFloor) return true;

        for (let req of this.pickupRequests) {
            if (req.floorNumber === this.currentFloor && req.direction === this.direction) {
                return true;
            }
        }
        return false;
    }

    handleAlighting() {
        const occupantsCopy = [...this.occupants];
        for (let rider of occupantsCopy) {
            if (rider.destFloorNum === this.currentFloor) {
                rider.exitElev(this);
                this.buttons[this.currentFloor].reset();
            }
        }
        this.destinationRequests.delete(this.currentFloor);
    }

    async handleBoarding() {
        const currentFloorObj = this.building.getFloor(this.currentFloor);
        const waitingRiders = [...currentFloorObj.waiting];

        waitingRiders.sort((a, b) => {
            const aMatches = (a.intendedDirection === this.direction);
            const bMatches = (b.intendedDirection === this.direction);
            if (aMatches && !bMatches) return -1;
            if (!aMatches && bMatches) return 1;
            return a.id - b.id;
        });

        for (let rider of waitingRiders) {
            if (this.currentWeight + rider.weight <= this.weightLimit) {
                const riderReqDir = rider.intendedDirection;

                if (this.canRiderBoard(riderReqDir)) {
                    const pickupToClear = this.pickupRequests.find(pr => pr.floorNumber === this.currentFloor && pr.direction === riderReqDir);

                    const selectedDest = await promptForDestination(rider, this);
                    rider.destFloorNum = selectedDest;

                    rider.enter(this);
                    this.pressDestinationButton(rider.destFloorNum);

                    if (pickupToClear) {
                        const idx = this.pickupRequests.indexOf(pickupToClear);
                        if (idx !== -1) this.pickupRequests.splice(idx, 1);
                        this.building.clearFloorRequest(pickupToClear.floorNumber, pickupToClear.direction);
                    }
                    render();
                }
            }
        }

        const pickupsAtThisFloor = this.pickupRequests.filter(pr => pr.floorNumber === this.currentFloor && this.canRiderBoard(pr.direction));

        for (let pr of pickupsAtThisFloor) {
            const hasWaiting = currentFloorObj.waiting.some(w => w.intendedDirection === pr.direction);
            if (!hasWaiting) {
                const idx = this.pickupRequests.indexOf(pr);
                if (idx !== -1) {
                    this.pickupRequests.splice(idx, 1);
                    this.building.clearFloorRequest(pr.floorNumber, pr.direction);
                }
            }
        }
    }

    async update() {
        if (this.doorsOpen) {
            this.doorTimer++;
            if (this.doorTimer >= this.DOOR_OPEN_DURATION) {
                this.doorsOpen = false;
                this.doorTimer = 0;
            } else {
                await this.handleBoarding();
                return;
            }
        }

        const nextTarget = this.getNextTargetFloor();
        if (nextTarget !== null) {
            if (nextTarget > this.currentFloor) this.direction = Direction.UP;
            else if (nextTarget < this.currentFloor) this.direction = Direction.DOWN;
        } else {
            this.direction = Direction.IDLE;
        }

        if (this.shouldStopAtCurrentFloor()) {
            if (!this.doorsOpen) {
                this.doorsOpen = true;
                this.doorTimer = 0;
                this.handleAlighting();
            }
            return;
        }

        if (this.direction === Direction.UP) {
            this.currentFloor++;
        } else if (this.direction === Direction.DOWN) {
            this.currentFloor--;
        }
    }
}

class Building {
    constructor(numFloors = 10, numElevators = 1) {
        this.numFloors = numFloors;
        this.numElevators = numElevators;
        this.occupants = [];
        this.floorRequests = [];
        this.fadeCounters = new Map();

        this.floors = [new Lobby(0, this)];
        for (let i = 1; i < numFloors - 1; i++) {
            this.floors.push(new MiddleFloor(i, this));
        }
        this.floors.push(new Roof(numFloors - 1, this));

        this.elevators = [];
        for (let i = 0; i < numElevators; i++) {
            this.elevators.push(new Elevator(this, i + 1, 2000));
        }
    }

    getFloor(index) {
        return this.floors[index];
    }

    getFloorName(floorNumber) {
        if (floorNumber === 0) return "Lobby";
        if (floorNumber === this.numFloors - 1) return "Roof";
        return `Floor ${floorNumber + 1}`;
    }

    addOccupant(rider) {
        if (!this.occupants.includes(rider)) this.occupants.push(rider);
    }

    removeOccupant(rider) {
        const idx = this.occupants.indexOf(rider);
        if (idx !== -1) this.occupants.splice(idx, 1);
    }

    addFloorRequest(floorNumber, direction) {
        const exists = this.floorRequests.some(r => r.floorNumber === floorNumber && r.direction === direction);
        if (!exists) {
            const req = new FloorRequest(floorNumber, direction);
            this.floorRequests.push(req);
            this.dispatchRequest(req);
        }
    }

    clearFloorRequest(floorNumber, direction) {
        const idx = this.floorRequests.findIndex(r => r.floorNumber === floorNumber && r.direction === direction);
        if (idx !== -1) {
            this.floorRequests.splice(idx, 1);
            const floorObj = this.floors[floorNumber];
            if (direction === Direction.UP) floorObj.resetUpButton();
            else if (direction === Direction.DOWN) floorObj.resetDownButton();
        }
    }

    dispatchRequest(request) {
        let bestElev = null;
        let minScore = Infinity;

        for (let elev of this.elevators) {
            const dist = Math.abs(elev.currentFloor - request.floorNumber);
            let score;
            if (elev.direction === Direction.IDLE) score = dist;
            else if (elev.direction === request.direction) score = dist + 5;
            else score = dist + 30;

            if (score < minScore) {
                minScore = score;
                bestElev = elev;
            }
        }

        if (bestElev) {
            bestElev.assignPickupRequest(request.floorNumber, request.direction);
        }
    }

    async tick() {
        for (let r of [...this.occupants]) {
            if (r.elevator === null && r.currentFloorNum === r.destFloorNum) {
                if (!this.fadeCounters.has(r)) {
                    this.fadeCounters.set(r, 2);
                }
            }
        }

        const toRemove = [];
        for (let [rider, ticksLeft] of this.fadeCounters.entries()) {
            ticksLeft--;
            if (ticksLeft <= 0) toRemove.push(rider);
            else this.fadeCounters.set(rider, ticksLeft);
        }

        for (let r of toRemove) {
            this.fadeCounters.delete(r);
            this.removeOccupant(r);
            this.getFloor(r.currentFloorNum).removeRiderWaiting(r);
        }

        for (let elev of this.elevators) {
            await elev.update();
        }

        for (let req of [...this.floorRequests]) {
            const isHandled = this.elevators.some(elev =>
                elev.pickupRequests.some(pr => pr.equals(req))
            );
            if (!isHandled) this.dispatchRequest(req);
        }
    }
}

// ==============================================================================
// STABLE VIEWPORT HIGH-DPI CANVAS CONTROLLER
// ==============================================================================

let logicalWidth = 620;
let logicalHeight = 750;
let marginY = 40;

const BUTTON_WIDTH = 22;
const BUTTON_HEIGHT = 20;

let buttonXUp = 110;
let buttonXDown = 140;
let queueRightBound = 380;
let shaftXStart = 420;
let shaftWidth = 65;
let rightMargin = 30;

const canvas = document.getElementById("elevatorCanvas");
const ctx = canvas.getContext("2d");
const canvasCard = document.getElementById("canvasCard");

const modal = document.getElementById("destinationModal");
const modalTitle = document.getElementById("modalTitle");
const modalFloorGrid = document.getElementById("modalFloorGrid");
const togglePlayBtn = document.getElementById("togglePlayBtn");
const resetBtn = document.getElementById("resetBtn");

let building = new Building(10, 1);
let isRunning = true;
let timerInterval = null;
let isPromptActive = false;

let lastAppliedWidth = 0;
let lastAppliedHeight = 0;

function updateCanvasLayout(force = false) {
    if (!canvasCard) return;

    const rect = canvasCard.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);

    if (w <= 0 || h <= 0) return;

    // Ignore small browser URL bar shifts (< 100px) so scrolling won't resize floors
    const heightDelta = Math.abs(h - lastAppliedHeight);
    const widthDelta = Math.abs(w - lastAppliedWidth);

    if (!force && lastAppliedHeight > 0 && widthDelta === 0 && heightDelta < 100) {
        return;
    }

    lastAppliedWidth = w;
    lastAppliedHeight = h;

    logicalWidth = w;
    logicalHeight = h;

    marginY = Math.max(26, Math.floor(logicalHeight * 0.045));

    rightMargin = Math.max(16, Math.floor(logicalWidth * 0.04));
    shaftWidth = Math.min(70, Math.max(50, Math.floor(logicalWidth * 0.14)));
    shaftXStart = logicalWidth - rightMargin - shaftWidth;

    const leftAvailable = shaftXStart - 20;
    queueRightBound = Math.max(200, leftAvailable);
    buttonXDown = Math.max(120, Math.min(160, Math.floor(logicalWidth * 0.28)));
    buttonXUp = buttonXDown - 28;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(logicalWidth * dpr);
    canvas.height = Math.floor(logicalHeight * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    render();
}

function promptForDestination(rider, elevator) {
    return new Promise((resolve) => {
        isPromptActive = true;
        if (isRunning) clearInterval(timerInterval);

        const currentFloor = elevator.currentFloor;
        const numFloors = building.numFloors;
        const dirSuffix = (rider.intendedDirection === Direction.UP) ? "Up" : "Down";
        
        modalTitle.innerText = `Rider ${rider.id} enters Elevator ${elevator.id} going ${dirSuffix}`;
        modalFloorGrid.innerHTML = "";

        for (let f = numFloors - 1; f >= 0; f--) {
            const floorName = building.getFloorName(f);
            const btn = document.createElement("button");
            btn.className = "floor-btn";
            btn.innerText = floorName;

            if (f === currentFloor) {
                btn.innerText = `${floorName} (Here)`;
                btn.disabled = true;
            } else if (rider.intendedDirection === Direction.UP && f > currentFloor) {
                btn.disabled = false;
                btn.onclick = () => {
                    modal.style.display = "none";
                    isPromptActive = false;
                    if (isRunning) startTimer();
                    resolve(f);
                };
            } else if (rider.intendedDirection === Direction.DOWN && f < currentFloor) {
                btn.disabled = false;
                btn.onclick = () => {
                    modal.style.display = "none";
                    isPromptActive = false;
                    if (isRunning) startTimer();
                    resolve(f);
                };
            } else {
                btn.disabled = true;
            }

            modalFloorGrid.appendChild(btn);
        }

        modal.style.display = "flex";
    });
}

function render() {
    const width = logicalWidth;
    const height = logicalHeight;
    const numFloors = building.numFloors;
    const usableHeight = height - (2 * marginY);
    const floorHeight = Math.floor(usableHeight / numFloors);

    ctx.clearRect(0, 0, width, height);

    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#333333";
    ctx.fillText("Click ▲ or ▼ to call elevator:", 16, Math.max(16, marginY - 12));

    // 1. Draw Floors & Buttons
    for (let i = 0; i < numFloors; i++) {
        const yLine = height - marginY - (i * floorHeight);
        const buttonY = yLine - 23;
        const floorObj = building.getFloor(i);

        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, yLine);
        ctx.lineTo(width - rightMargin, yLine);
        ctx.stroke();

        ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillStyle = "#333333";
        ctx.fillText(building.getFloorName(i), 16, yLine - 5);

        // UP Button
        if (i < numFloors - 1) {
            ctx.fillStyle = floorObj.isUpButtonPressed() ? "#ff8c00" : "#ffffff";
            ctx.fillRect(buttonXUp, buttonY, BUTTON_WIDTH, BUTTON_HEIGHT);
            ctx.strokeStyle = "#000000";
            ctx.strokeRect(buttonXUp, buttonY, BUTTON_WIDTH, BUTTON_HEIGHT);
            ctx.fillStyle = "#000000";
            ctx.fillText("▲", buttonXUp + 5, buttonY + 14);
        }

        // DOWN Button
        if (i > 0) {
            ctx.fillStyle = floorObj.isDownButtonPressed() ? "#ff8c00" : "#ffffff";
            ctx.fillRect(buttonXDown, buttonY, BUTTON_WIDTH, BUTTON_HEIGHT);
            ctx.strokeStyle = "#000000";
            ctx.strokeRect(buttonXDown, buttonY, BUTTON_WIDTH, BUTTON_HEIGHT);
            ctx.fillStyle = "#000000";
            ctx.fillText("▼", buttonXDown + 5, buttonY + 14);
        }

        // 2. Draw Waiting & Arrived Riders
        let currentX = queueRightBound;
        const occupants = building.occupants;

        for (let r of occupants) {
            if (r.elevator === null && r.currentFloorNum === i) {
                const isWaiting = floorObj.waiting.includes(r);
                const idStr = String(r.id);

                ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                const textWidth = ctx.measureText(idStr).width;
                const iconHeight = 14;
                const iconWidth = Math.max(14, textWidth + 8);

                const riderX = currentX - iconWidth;
                const iconY = yLine - 22;
                const textX = riderX + (iconWidth - textWidth) / 2;
                const textY = iconY + 10;

                if (isWaiting) {
                    ctx.fillStyle = "rgb(70, 130, 180)";
                    drawRoundRect(ctx, riderX, iconY, iconWidth, iconHeight, iconHeight / 2, true, false);
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(idStr, textX, textY);
                } else {
                    let alpha = 1.0;
                    if (building.fadeCounters.has(r)) {
                        alpha = building.fadeCounters.get(r) / 2.0;
                    }
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

                    ctx.fillStyle = "rgb(46, 139, 87)";
                    drawRoundRect(ctx, riderX, iconY, iconWidth, iconHeight, iconHeight / 2, true, false);
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(idStr, textX, textY);

                    ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                    ctx.fillStyle = "rgb(46, 139, 87)";
                    const doneWidth = ctx.measureText("Done").width;
                    ctx.fillText("Done", riderX + (iconWidth - doneWidth) / 2, yLine - 25);
                    ctx.restore();
                }

                currentX = riderX - 16;
            }
        }
    }

    // 3. Draw Elevators & Shafts
    const elevators = building.elevators;
    for (let i = 0; i < elevators.length; i++) {
        const elev = elevators[i];
        const x = shaftXStart;
        const currentFloor = elev.currentFloor;
        const y = height - marginY - (currentFloor * floorHeight) - floorHeight + 4;

        ctx.fillStyle = "#e6e6e6";
        ctx.fillRect(x, marginY, shaftWidth, usableHeight);
        ctx.strokeStyle = "#808080";
        ctx.strokeRect(x, marginY, shaftWidth, usableHeight);

        ctx.fillStyle = elev.doorsOpen ? "rgb(144, 238, 144)" : "rgb(112, 128, 144)";
        ctx.fillRect(x + 4, y, shaftWidth - 8, floorHeight - 8);
        ctx.strokeStyle = "#000000";
        ctx.strokeRect(x + 4, y, shaftWidth - 8, floorHeight - 8);

        ctx.fillStyle = "#000000";
        ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText("E" + elev.id, x + 8, y + 16);
        ctx.fillText("Occ: " + elev.occupants.length, x + 8, y + 29);

        let dirSymbol = "■";
        if (elev.direction === Direction.UP) dirSymbol = "▲";
        else if (elev.direction === Direction.DOWN) dirSymbol = "▼";
        ctx.fillText(dirSymbol, x + shaftWidth - 18, y + 16);
    }
}

function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

// Checks if pointer is over button bounds
function isHoveringButton(clientX, clientY) {
    if (isPromptActive) return false;

    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const numFloors = building.numFloors;
    const usableHeight = logicalHeight - (2 * marginY);
    const floorHeight = Math.floor(usableHeight / numFloors);

    for (let i = 0; i < numFloors; i++) {
        const yLine = logicalHeight - marginY - (i * floorHeight);
        const buttonY = yLine - 23;

        if (mouseY >= buttonY - 2 && mouseY <= buttonY + BUTTON_HEIGHT + 2) {
            if (i < numFloors - 1 && mouseX >= buttonXUp - 2 && mouseX <= buttonXUp + BUTTON_WIDTH + 2) {
                return true;
            }
            if (i > 0 && mouseX >= buttonXDown - 2 && mouseX <= buttonXDown + BUTTON_WIDTH + 2) {
                return true;
            }
        }
    }
    return false;
}

canvas.addEventListener("mousemove", (e) => {
    if (isHoveringButton(e.clientX, e.clientY)) {
        canvas.style.cursor = "pointer";
    } else {
        canvas.style.cursor = "default";
    }
});

canvas.addEventListener("mouseleave", () => {
    canvas.style.cursor = "default";
});

// Click and Tap handler: Only triggers when tapping exact button areas
function handleInputCoord(clientX, clientY) {
    if (isPromptActive) return false;

    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const numFloors = building.numFloors;
    const usableHeight = logicalHeight - (2 * marginY);
    const floorHeight = Math.floor(usableHeight / numFloors);

    for (let i = 0; i < numFloors; i++) {
        const yLine = logicalHeight - marginY - (i * floorHeight);
        const buttonY = yLine - 23;
        const floorObj = building.getFloor(i);

        if (mouseY >= buttonY - 6 && mouseY <= buttonY + BUTTON_HEIGHT + 6) {
            // UP Button
            if (i < numFloors - 1 && mouseX >= buttonXUp - 6 && mouseX <= buttonXUp + BUTTON_WIDTH + 6) {
                if (!floorObj.isUpButtonPressed()) {
                    const weight = 100 + Math.floor(Math.random() * 101);
                    const rider = new Rider(building, i, Direction.UP, weight);
                    rider.requestElevator();
                    render();
                }
                return true;
            }
            // DOWN Button
            if (i > 0 && mouseX >= buttonXDown - 6 && mouseX <= buttonXDown + BUTTON_WIDTH + 6) {
                if (!floorObj.isDownButtonPressed()) {
                    const weight = 100 + Math.floor(Math.random() * 101);
                    const rider = new Rider(building, i, Direction.DOWN, weight);
                    rider.requestElevator();
                    render();
                }
                return true;
            }
        }
    }
    return false;
}

// Track touch distance so scrolling / swiping is NEVER intercepted as a button press
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }
}, { passive: true });

canvas.addEventListener("touchend", (e) => {
    if (e.changedTouches.length === 1) {
        const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX);
        const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);

        // Only register as button click if user tapped without dragging/scrolling (< 10px movement)
        if (deltaX < 10 && deltaY < 10) {
            handleInputCoord(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }
    }
}, { passive: true });

canvas.addEventListener("click", (e) => {
    handleInputCoord(e.clientX, e.clientY);
});

function updateButtonVisuals() {
    if (isRunning) {
        togglePlayBtn.innerText = "Pause";
        togglePlayBtn.classList.remove("paused");
    } else {
        togglePlayBtn.innerText = "Play";
        togglePlayBtn.classList.add("paused");
    }
}

togglePlayBtn.addEventListener("click", () => {
    isRunning = !isRunning;
    updateButtonVisuals();
    if (isRunning && !isPromptActive) startTimer();
    else clearInterval(timerInterval);
});

resetBtn.addEventListener("click", () => {
    modal.style.display = "none";
    isPromptActive = false;
    nextRiderId = 1;
    building = new Building(10, 1);
    
    isRunning = true;
    updateButtonVisuals();
    
    render();
    clearInterval(timerInterval);
    startTimer();
});

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(async () => {
        if (!isPromptActive) {
            await building.tick();
            render();
        }
    }, 1000);
}

const resizeObserver = new ResizeObserver(() => {
    updateCanvasLayout(false);
});
resizeObserver.observe(canvasCard);

window.addEventListener("orientationchange", () => {
    setTimeout(() => updateCanvasLayout(true), 150);
});

window.addEventListener("load", () => {
    updateCanvasLayout(true);
    updateButtonVisuals();
    startTimer();
});