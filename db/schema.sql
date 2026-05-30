-- =========================================
-- ONLINE ZAKAT PAYMENT MANAGEMENT MIS
-- COMPLETE DATABASE STRUCTURE
-- =========================================

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    age INT,
    gender ENUM('MALE','FEMALE'),
    country VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    role ENUM('SUPERUSER','ADMIN','DONOR') DEFAULT 'DONOR',
    avatar_url VARCHAR(191) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
);

CREATE TABLE permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codename VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE user_group (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    group_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE(user_id, group_id)
);

CREATE TABLE group_permission (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    permission_id INT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(group_id, permission_id)
);

CREATE TABLE user_permission (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    permission_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(user_id, permission_id)
);

CREATE TABLE accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0,
    status ENUM('ACTIVE','SUSPENDED') DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE nisab_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gold_price_per_gram DECIMAL(10,2) NOT NULL,
    nisab_value DECIMAL(15,2) NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE zakat_calculations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_assets DECIMAL(15,2) NOT NULL,
    liabilities DECIMAL(15,2) DEFAULT 0,
    net_assets DECIMAL(15,2) NOT NULL,
    nisab_value DECIMAL(15,2) NOT NULL,
    zakat_due DECIMAL(15,2) NOT NULL,
    zakat_year YEAR,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_zakat_calc_user_year (user_id, zakat_year)
);

CREATE TABLE zakat_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    calculation_id INT NULL,
    amount DECIMAL(15,2) NOT NULL,
    zakat_type ENUM('MAAL','BUSINESS') NOT NULL,
    method ENUM('EVCPLUS','E_DAHAB','ZAAD','CASH','WALLET') NOT NULL,
    status ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
    reference_number VARCHAR(255),
    approved_by INT,
    approved_at DATETIME,
    nisab_checked BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (calculation_id) REFERENCES zakat_calculations(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_payments_status (status)
);

CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    account_id INT,
    zakat_payment_id INT,
    type ENUM('DEPOSIT','ZAKAT_PAYMENT','DISTRIBUTION') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status ENUM('PENDING','SUCCESS','FAILED') DEFAULT 'SUCCESS',
    transaction_code VARCHAR(100) UNIQUE,
    reference VARCHAR(255),
    gateway_response TEXT,
    description TEXT,
    journal_entry_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (zakat_payment_id) REFERENCES zakat_payments(id),
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
    INDEX idx_transactions_user (user_id),
    INDEX idx_transactions_status (status),
    INDEX idx_transactions_journal (journal_entry_id)
);

-- =========================================
-- ENTERPRISE ACCOUNTING WALLETS
-- =========================================

CREATE TABLE chart_of_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    account_type ENUM('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE') NOT NULL,
    parent_id INT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id),
    INDEX idx_coa_type (account_type)
);

CREATE TABLE system_wallets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    wallet_type ENUM('MAIN','ZAKAT','SADAQAH','EMERGENCY','OPERATIONS') NOT NULL,
    chart_account_id INT NOT NULL,
    status ENUM('ACTIVE','SUSPENDED') DEFAULT 'ACTIVE',
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (chart_account_id) REFERENCES chart_of_accounts(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_wallets_type (wallet_type),
    INDEX idx_wallets_status (status)
);

CREATE TABLE journal_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_number VARCHAR(50) NOT NULL UNIQUE,
    entry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    reference_type ENUM('ZAKAT_PAYMENT','DISTRIBUTION','MANUAL','OPENING_BALANCE') NOT NULL,
    reference_id INT NULL,
    status ENUM('POSTED','REVERSED') DEFAULT 'POSTED',
    posted_by INT NULL,
    posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reversed_by INT NULL,
    reversed_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (posted_by) REFERENCES users(id),
    FOREIGN KEY (reversed_by) REFERENCES users(id),
    INDEX idx_journal_ref (reference_type, reference_id),
    INDEX idx_journal_status (status)
);

CREATE TABLE journal_entry_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    journal_entry_id INT NOT NULL,
    account_id INT NOT NULL,
    wallet_id INT NULL,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    line_description VARCHAR(255),
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id),
    FOREIGN KEY (wallet_id) REFERENCES system_wallets(id),
    INDEX idx_jel_account (account_id),
    INDEX idx_jel_wallet (wallet_id)
);

CREATE TABLE beneficiaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    gender ENUM('MALE','FEMALE'),
    category ENUM('POOR','ORPHAN','WIDOW','DISABLED','STUDENT','EMERGENCY'),
    national_id VARCHAR(100),
    family_size INT,
    monthly_income DECIMAL(15,2),
    address TEXT,
    status ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED') DEFAULT 'PENDING',
    verified_by INT NULL,
    verified_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (verified_by) REFERENCES users(id),
    INDEX idx_beneficiaries_status (status)
);

CREATE TABLE distributions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    beneficiary_id INT NOT NULL,
    admin_id INT NOT NULL,
    transaction_id INT,
    amount DECIMAL(15,2) NOT NULL,
    distribution_type ENUM('FOOD','CASH','MEDICAL','EDUCATION','WATER','EMERGENCY') NOT NULL,
    status ENUM('PENDING','APPROVED','COMPLETED','REJECTED') DEFAULT 'PENDING',
    notes TEXT,
    approved_by INT NULL,
    approved_at DATETIME NULL,
    completed_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id),
    FOREIGN KEY (admin_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    INDEX idx_distributions_status (status)
);

CREATE TABLE community_distributions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    transaction_id INT NULL,
    title VARCHAR(255) NOT NULL,
    distribution_type ENUM('FOOD','CASH','MEDICAL','EDUCATION','WATER','EMERGENCY') NOT NULL,
    beneficiary_count INT DEFAULT 0,
    amount DECIMAL(15,2) NOT NULL,
    location VARCHAR(255),
    status ENUM('PENDING','APPROVED','COMPLETED','REJECTED') DEFAULT 'PENDING',
    notes TEXT,
    approved_by INT NULL,
    approved_at DATETIME NULL,
    completed_at DATETIME NULL,
    distribution_date DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    INDEX idx_community_distributions_status (status)
);

CREATE TABLE receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_notifications_user (user_id),
    INDEX idx_notifications_user_read (user_id, is_read)
);

CREATE TABLE reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(100),
    generated_by INT,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generated_by) REFERENCES users(id)
);

CREATE TABLE backups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backup_name VARCHAR(255),
    file_path VARCHAR(255),
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE audits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    path VARCHAR(255),
    action TEXT,
    module TEXT,
    operating_system VARCHAR(200),
    browser VARCHAR(200),
    ip_address VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audits_user (user_id)
);
