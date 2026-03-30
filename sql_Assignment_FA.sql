-- =========================
-- CREATE DATABASE
-- =========================
CREATE DATABASE ass;
GO

USE ass;
GO

-- =========================
-- 1. ROLES
-- =========================
CREATE TABLE Roles (
    RoleID INT PRIMARY KEY IDENTITY(1,1),
    RoleName NVARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO Roles (RoleName) VALUES 
('Reporter'),
('Dispatcher'),
('Technician');

-- =========================
-- 2. USERS
-- =========================
CREATE TABLE Users (
    UserID INT PRIMARY KEY IDENTITY(1,1),
    FullName NVARCHAR(100) NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    PasswordHash VARCHAR(MAX) NOT NULL,
    RoleID INT NOT NULL FOREIGN KEY REFERENCES Roles(RoleID)
);

INSERT INTO Users (FullName, Email, PasswordHash, RoleID) VALUES
('Nguyen Van A', 'a@gmail.com', 'hash1', 1),
('Tran Thi B', 'b@gmail.com', 'hash2', 1),
('Le Van C', 'c@gmail.com', 'hash3', 1),
('Pham Thi D', 'd@gmail.com', 'hash4', 2),
('Hoang Van E', 'e@gmail.com', 'hash5', 2),
('Do Van F', 'f@gmail.com', 'hash6', 3),
('Bui Thi G', 'g@gmail.com', 'hash7', 3),
('Vo Van H', 'h@gmail.com', 'hash8', 3),
('Dang Thi I', 'i@gmail.com', 'hash9', 1),
('Phan Van K', 'k@gmail.com', 'hash10', 3);

-- =========================
-- 3. CATEGORIES
-- =========================
CREATE TABLE Categories (
    CategoryID INT PRIMARY KEY IDENTITY(1,1),
    CategoryName NVARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO Categories (CategoryName) VALUES
(N'Electrical'),
(N'Water'),
(N'Internet'),
(N'Air Conditioner'),
(N'Furniture'),
(N'Projector'),
(N'Computer'),
(N'Cleaning'),
(N'Security'),
(N'Plumbing');

-- =========================
-- 4. TICKETS
-- =========================
CREATE TABLE Tickets (
    TicketID INT PRIMARY KEY IDENTITY(1,1),
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NOT NULL,
    Location NVARCHAR(100) NOT NULL,
    Priority INT CHECK (Priority BETWEEN 1 AND 3),
    Status VARCHAR(20) 
        CHECK (Status IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED'))
        DEFAULT 'OPEN',

    ImageBefore NVARCHAR(MAX),
    ImageAfter NVARCHAR(MAX),

    CreatedAt DATETIME DEFAULT GETDATE(),
    AssignedAt DATETIME NULL,
    ResolvedAt DATETIME NULL,
    ClosedAt DATETIME NULL,

    ReporterID INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CategoryID INT NOT NULL FOREIGN KEY REFERENCES Categories(CategoryID),
    TechnicianID INT NULL FOREIGN KEY REFERENCES Users(UserID),
    DispatcherID INT NULL FOREIGN KEY REFERENCES Users(UserID)
);

INSERT INTO Tickets 
(Title, Description, Location, Priority, Status, ReporterID, CategoryID, TechnicianID, DispatcherID)
VALUES
(N'Broken Light', N'Light not working in room A1', N'Room A1', 2, 'OPEN', 1, 1, NULL, NULL),
(N'Water Leak', N'Water leaking in restroom', N'Restroom B2', 3, 'ASSIGNED', 2, 2, 6, 4),
(N'Internet Down', N'No internet connection', N'Lab C1', 3, 'IN_PROGRESS', 3, 3, 7, 4),
(N'AC Not Cooling', N'Air conditioner broken', N'Room D3', 2, 'RESOLVED', 9, 4, 8, 5),
(N'Broken Chair', N'Chair wheel broken', N'Room E4', 1, 'CLOSED', 1, 5, 6, 4),
(N'Projector Issue', N'Projector not displaying', N'Room F2', 2, 'OPEN', 2, 6, NULL, NULL),
(N'Computer Error', N'Blue screen error', N'Lab A2', 3, 'ASSIGNED', 3, 7, 7, 5),
(N'Cleaning Request', N'Need urgent cleaning', N'Hall 1', 1, 'IN_PROGRESS', 9, 8, 8, 4),
(N'Security Camera', N'Camera not recording', N'Gate', 3, 'RESOLVED', 1, 9, 6, 5),
(N'Broken Faucet', N'Faucet leaking water', N'Restroom C3', 2, 'CLOSED', 2, 10, 7, 4);

-- =========================
-- 5. REVIEWS
-- =========================
CREATE TABLE Reviews (
    ReviewID INT PRIMARY KEY IDENTITY(1,1),
    TicketID INT UNIQUE FOREIGN KEY REFERENCES Tickets(TicketID),
    Rating INT CHECK (Rating BETWEEN 1 AND 5),
    Comment NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE()
);

INSERT INTO Reviews (TicketID, Rating, Comment) VALUES
(4, 5, N'Fixed quickly'),
(5, 4, N'Good service'),
(9, 5, N'Excellent job'),
(10, 4, N'Solved properly');

-- =========================
-- 6. SUPPLIES
-- =========================
CREATE TABLE Supplies (
    SupplyID INT PRIMARY KEY IDENTITY(1,1),
    SupplyName NVARCHAR(100) NOT NULL,
    Unit NVARCHAR(20),
    UnitPrice DECIMAL(18, 2) CHECK (UnitPrice >= 0),
    StockQuantity INT DEFAULT 0 CHECK (StockQuantity >= 0)
);

INSERT INTO Supplies (SupplyName, Unit, UnitPrice, StockQuantity) VALUES
(N'Light Bulb', N'Piece', 50000, 100),
(N'Wire Cable', N'Meter', 10000, 500),
(N'Water Pipe', N'Meter', 20000, 200),
(N'Router', N'Piece', 800000, 20),
(N'Air Filter', N'Piece', 150000, 50),
(N'Chair Wheel', N'Piece', 30000, 60),
(N'HDMI Cable', N'Piece', 120000, 40),
(N'Cleaning Liquid', N'Bottle', 70000, 80),
(N'Door Lock', N'Piece', 250000, 30),
(N'Faucet', N'Piece', 180000, 25);

-- =========================
-- 7. TICKET SUPPLIES
-- =========================
CREATE TABLE TicketSupplies (
    TicketID INT,
    SupplyID INT,
    QuantityUsed INT NOT NULL CHECK (QuantityUsed > 0),

    PRIMARY KEY (TicketID, SupplyID),

    FOREIGN KEY (TicketID) REFERENCES Tickets(TicketID) ON DELETE CASCADE,
    FOREIGN KEY (SupplyID) REFERENCES Supplies(SupplyID)
);

INSERT INTO TicketSupplies (TicketID, SupplyID, QuantityUsed) VALUES
(2, 3, 5),
(3, 4, 1),
(4, 5, 2),
(5, 6, 4),
(7, 2, 10),
(8, 8, 3),
(9, 9, 1),
(10, 10, 2),
(2, 1, 2),
(3, 7, 1);

-- =========================
-- 8. TICKET HISTORY
-- =========================
CREATE TABLE TicketHistory (
    HistoryID INT PRIMARY KEY IDENTITY(1,1),
    TicketID INT NOT NULL FOREIGN KEY REFERENCES Tickets(TicketID),
    OldStatus VARCHAR(20) 
        CHECK (OldStatus IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED')),
    NewStatus VARCHAR(20) 
        CHECK (NewStatus IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED')),
    ChangedBy INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    ChangedAt DATETIME DEFAULT GETDATE()
);

INSERT INTO TicketHistory (TicketID, OldStatus, NewStatus, ChangedBy) VALUES
(2, 'OPEN', 'ASSIGNED', 4),
(3, 'OPEN', 'ASSIGNED', 4),
(3, 'ASSIGNED', 'IN_PROGRESS', 7),
(4, 'OPEN', 'ASSIGNED', 5),
(4, 'ASSIGNED', 'IN_PROGRESS', 8),
(4, 'IN_PROGRESS', 'RESOLVED', 8),
(5, 'RESOLVED', 'CLOSED', 1),
(9, 'IN_PROGRESS', 'RESOLVED', 6),
(10, 'RESOLVED', 'CLOSED', 2),
(7, 'OPEN', 'ASSIGNED', 5);

ALTER TABLE Users 
ADD ResetPasswordOTP NVARCHAR(MAX) NULL, 
    ResetPasswordOTPExpiry DATETIME2 NULL;



SELECT * FROM Roles;
SELECT * FROM Users;
SELECT * FROM Categories;
SELECT * FROM Tickets;
SELECT * FROM Reviews;
SELECT * FROM Supplies;
SELECT * FROM TicketSupplies;
SELECT * FROM TicketHistory;