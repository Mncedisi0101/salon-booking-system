// const appointments = require("../api/appointments");

// Global variables
let currentBusinessId = null;
let currentUserId = null;
let currentUserType = null;
let currentBusinessData = null;
let businessServices = [];
let userType = null; // 'customer' or 'business'
let notifications = JSON.parse(localStorage.getItem('businessNotifications') || '[]');
let currentPage = 1;
const appointmentsPerPage = 10;

// Business Registration Functions
function initBusinessRegistration() {
    const businessForm = document.getElementById('businessForm');
    const addServiceBtn = document.getElementById('addService');
    const servicesContainer = document.querySelector('.services-container');
    
    // Add service field
    if (addServiceBtn && servicesContainer) {
        addServiceBtn.addEventListener('click', function() {
            const serviceInput = document.createElement('div');
            serviceInput.className = 'service-input';
            serviceInput.innerHTML = `
                <input type="text" placeholder="Service name" class="service-name" required>
                <input type="number" placeholder="Price (R)" class="service-price" min="0" step="0.01" required>
                <input type="number" placeholder="Duration (minutes)" class="service-duration" min="1" required>
                <button type="button" class="remove-service">Remove</button>
            `;
            servicesContainer.appendChild(serviceInput);
            
            // Add remove functionality
            serviceInput.querySelector('.remove-service').addEventListener('click', function() {
                servicesContainer.removeChild(serviceInput);
            });
        });
    }
}

// Authentication functions for index page
function initBusinessAuthentication() {
    const businessForm = document.getElementById('businessForm');
    // Business registration
    if (businessForm) {
        businessForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleBusinessRegistration();
        });
    }
}

async function handleBusinessRegistration() {
    const businessForm = document.getElementById('businessForm');
    const submitBtn = businessForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Registering...';
    submitBtn.disabled = true;
    
    try {
        // Collect services
        const services = [];
        const serviceInputs = document.querySelectorAll('.service-input');
        
        serviceInputs.forEach(input => {
            const name = input.querySelector('.service-name').value;
            const description = input.querySelector('.service-description')?.value || '';
            const price = parseFloat(input.querySelector('.service-price').value);
            const duration = parseInt(input.querySelector('.service-duration').value);
            
            if (name && !isNaN(price) && !isNaN(duration)) {
                services.push({ name, description, price, duration });
            }
        });
        
        if (services.length === 0) {
            alert('Please add at least one service');
            return;
        }
        
        // Check password
        const password = document.getElementById('password').value;
        if (password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }
        
        // Prepare business data
        const businessData = {
            type: 'business_register',
            name: document.getElementById('businessName').value,
            email: document.getElementById('email').value,
            password: password,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            services: services
        };
        
        console.log('Sending registration request to /api/auth...');
        
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(businessData)
        });
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        if (!response.ok) {
            if (response.status === 405) {
                throw new Error('API endpoint not configured properly. Please check server setup.');
            } 
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorText = await response.text();
                if (errorText) {
                    errorMessage = errorText;
                }
            } catch (e) {
                // Ignore if we can't read the error text
            }
            throw new Error(errorMessage);
        }
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text.substring(0, 200));
            throw new Error(`Server returned non-JSON response: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Registration successful:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Registration failed');
        }
        
        // Store business info and redirect to dashboard
        localStorage.setItem('businessUser', JSON.stringify(result.business));
        localStorage.setItem('userType', 'business');
        
        // Show success message
        document.getElementById('businessForm').closest('.form-container').classList.add('hidden');
        document.getElementById('successMessage').classList.remove('hidden');
        
        // Generate QR code
        await generateQRCode(result.business.id);
        
        // Update dashboard link
        const dashboardLink = document.getElementById('dashboardLink');
        if (dashboardLink) {
            dashboardLink.href = `business.html?id=${result.business.id}`;
            dashboardLink.onclick = () => {
                window.location.href = `business.html?id=${result.business.id}`;
            };
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        alert('Error registering business: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Function for QR code generation
async function generateQRCode(businessId) {
    try {
        console.log('Generating QR code for business:', businessId);
        const qrResponse = await fetch('/api/qrcode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ businessId })
        });
        
        console.log('QR code response status:', qrResponse.status);
        
        if (!qrResponse.ok) {
            throw new Error(`QR code generation failed: ${qrResponse.status}`);
        }
        
        const contentType = qrResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await qrResponse.text();
            throw new Error(`QR code server returned non-JSON: ${qrResponse.status}`);
        }
        
        const qrResult = await qrResponse.json();
        
        if (!qrResponse.ok) {
            throw new Error(qrResult.error || 'Failed to generate QR code');
        }
        
        // Update QR code container
        const qrCodeContainer = document.getElementById('qrCodeContainer');
        if (qrCodeContainer) {
            if (qrResult.qrCode) {
                qrCodeContainer.innerHTML = `<img src="${qrResult.qrCode}" alt="QR Code">`;
            } else {
                qrCodeContainer.innerHTML = '<p>QR code URL: ' + qrResult.url + '</p>';
            }
        }
        
        // Update business ID display
        const businessIdElement = document.getElementById('businessId');
        if (businessIdElement) {
            businessIdElement.textContent = businessId;
            
            // Update dashboard link
            const dashboardLink = document.querySelector('#successMessage a');
            if (dashboardLink) {
                dashboardLink.href = `business.html?id=${businessId}`;
            }
        }
        
        // FIXED: Store business ID for QR code usage
        localStorage.setItem('qrBusinessId', businessId);
        console.log('Stored business ID for QR code:', businessId);
        
    } catch (error) {
        console.error('QR code generation error:', error);
        
        // FIXED: Create a proper fallback URL with business parameter
        const fallbackUrl = `${window.location.protocol}//${window.location.host}/customer.html?business=${businessId}`;
        
        // Store business ID for the fallback URL
        localStorage.setItem('qrBusinessId', businessId);
        
        const qrCodeContainer = document.getElementById('qrCodeContainer');
        if (qrCodeContainer) {
            qrCodeContainer.innerHTML = `
                <div class="fallback-url">
                    <p>QR code generation failed. Use this URL for bookings:</p>
                    <p><strong>${fallbackUrl}</strong></p>
                    <p>You can generate a QR code later from your dashboard.</p>
                </div>
            `;
        }
    }
}

// Customer Authentication Functions
function initCustomerAuthentication() {
    const authTabs = document.querySelectorAll('.auth-tab');
    const customerLoginForm = document.getElementById('customerLoginForm');
    const customerRegisterForm = document.getElementById('customerRegisterForm');
    const businessLoginForm = document.getElementById('businessLoginForm');
    const goToDashboardBtn = document.getElementById('goToDashboard');
    
    // FIXED: Extract business ID early and log it for debugging
    const urlParams = new URLSearchParams(window.location.search);
    currentBusinessId = urlParams.get('business');
    
    console.log('Customer page initialized with business ID:', currentBusinessId);
    console.log('Full URL:', window.location.href);
    
    if (currentBusinessId) {
        console.log('Business ID successfully extracted from URL');
        // Store it in localStorage as backup
        localStorage.setItem('qrBusinessId', currentBusinessId);
    } else {
        // Check if we have a stored business ID from QR code
        const storedBusinessId = localStorage.getItem('qrBusinessId');
        if (storedBusinessId) {
            currentBusinessId = storedBusinessId;
            console.log('Using stored business ID from QR code:', currentBusinessId);
        } else {
            console.warn('No business ID found in URL or storage');
        }
    }
    
    // Tab switching
    authTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Update active tab
            authTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding form
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('businessForm').classList.add('hidden');
            
            if (targetTab === 'login') {
                document.getElementById('loginForm').classList.remove('hidden');
            } else if (targetTab === 'register') {
                document.getElementById('registerForm').classList.remove('hidden');
            } else if (targetTab === 'business') {
                document.getElementById('businessForm').classList.remove('hidden');
            }
        });
    });
    
    // Customer login
    if (customerLoginForm) {
        customerLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleCustomerLogin();
        });
    }
    
    // Customer registration
    if (customerRegisterForm) {
        customerRegisterForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleCustomerRegistration();
        });
    }
    
    // Business login
    if (businessLoginForm) {
        businessLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleBusinessLoginFromCustomerPage();
        });
    }
    
    // Go to dashboard button
    if (goToDashboardBtn) {
        goToDashboardBtn.addEventListener('click', function() {
            const businessUser = JSON.parse(localStorage.getItem('businessUser'));
            if (businessUser) {
                window.location.href = `business.html?id=${businessUser.id}`;
            }
        });
    }
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('customerUser');
            localStorage.removeItem('businessUser');
            localStorage.removeItem('userType');
            location.reload();
        });
    }
}

async function handleBusinessLoginFromCustomerPage() {
    const businessLoginForm = document.getElementById('businessLoginForm');
    const submitBtn = businessLoginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;
    
    try {
        const loginData = {
            type: 'business_login',
            email: document.getElementById('businessLoginEmail').value,
            password: document.getElementById('businessLoginPassword').value
        };
        
        console.log('Sending business login request:', loginData);
        
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });
        
        console.log('Business login response status:', response.status);
        
        // Check if response is JSON first
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON business login response:', text);
            throw new Error(`Server returned non-JSON: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Business login result:', result);
        
        if (!response.ok) {
            throw new Error(result.error || `Login failed with status: ${response.status}`);
        }
        
        if (!result.success) {
            throw new Error(result.error || 'Login failed');
        }
        
        // Store business info and show redirect option
        localStorage.setItem('businessUser', JSON.stringify(result.user));
        localStorage.setItem('userType', 'business');
        
        // Show business redirect section
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('businessRedirect').classList.remove('hidden');
        
    } catch (error) {
        console.error('Business login error:', error);
        alert('Error logging in: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

async function handleCustomerLogin() {
    const loginForm = document.getElementById('customerLoginForm');
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;
    
    try {
        const loginData = {
            type: 'customer_login',
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value,
            businessId: currentBusinessId
        };
        
        console.log('Sending customer login request:', loginData);
        
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });
        
        console.log('Customer login response status:', response.status);
        
        // Check if response is JSON first
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON customer login response:', text);
            throw new Error(`Server returned non-JSON: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Customer login result:', result);
        
        if (!response.ok) {
            throw new Error(result.error || `Login failed with status: ${response.status}`);
        }
        
        if (!result.success) {
            throw new Error(result.error || 'Login failed');
        }
        
        // Store customer info and show booking form
        localStorage.setItem('customerUser', JSON.stringify(result.user));
        localStorage.setItem('userType', 'customer');
        currentUserId = result.user.id;
        
        showBookingForm(result.user);
        
    } catch (error) {
        console.error('Login error:', error);
        alert('Error logging in: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function handleBusinessLoginRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const loginType = urlParams.get('type');
    
    if (loginType === 'business') {
        // Show business login tab
        const businessTab = document.querySelector('[data-tab="business"]');
        if (businessTab) {
            businessTab.click();
        }
        
        // Check if business user is already logged in
        const businessUser = localStorage.getItem('businessUser');
        const userType = localStorage.getItem('userType');
        
        if (businessUser && userType === 'business') {
            const user = JSON.parse(businessUser);
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('businessRedirect').classList.remove('hidden');
        }
    }
}

async function handleCustomerRegistration() {
    const registerForm = document.getElementById('customerRegisterForm');
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating Account...';
    submitBtn.disabled = true;
    
    try {
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const agreement = document.getElementById('registerAgreement').checked;
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }

        if (!agreement) {
            alert('You must agree to the collection and processing of your personal information');
            return;
        }

        // FIXED: Better business ID extraction from URL
        if (!currentBusinessId) {
            const urlParams = new URLSearchParams(window.location.search);
            currentBusinessId = urlParams.get('business');
            
            // Debug logging to help identify the issue
            console.log('URL Search Params:', window.location.search);
            console.log('Extracted business ID:', currentBusinessId);
            console.log('Full URL:', window.location.href);
        }
        
        // FIXED: More specific error message and validation
        if (!currentBusinessId) {
            // Check if there's a business ID in localStorage from QR code scan
            const qrBusinessId = localStorage.getItem('qrBusinessId');
            if (qrBusinessId) {
                currentBusinessId = qrBusinessId;
                console.log('Using business ID from QR code storage:', currentBusinessId);
            } else {
                console.error('No business ID found in URL or storage');
                alert('Invalid booking link. Please use the salon\'s booking QR code or URL that includes ?business=ID parameter.');
                return;
            }
        }

        // Validate business ID format
        if (currentBusinessId && currentBusinessId.length < 5) {
            console.error('Invalid business ID format:', currentBusinessId);
            alert('Invalid business ID in the booking link. Please scan the QR code again or contact the salon.');
            return;
        }
        
        const registerData = {
            type: 'customer_register',
            name: document.getElementById('registerName').value,
            email: document.getElementById('registerEmail').value,
            phone: document.getElementById('registerPhone').value,
            country: document.getElementById('registerCountry').value,
            password: password,
            businessId: currentBusinessId
        };

        console.log('Sending customer registration with business ID:', currentBusinessId);
        
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registerData)
        });
        
        if (!response.ok) {
            let message = `Registration failed: ${response.status}`;
            try {
                const maybeJson = await response.json();
                if (maybeJson && maybeJson.error) message = maybeJson.error;
            } catch (_) {
                try {
                    const text = await response.text();
                    if (text) message = text;
                } catch (_) {}
            }
            // Friendlier messages for common cases
            if (/Business ID is required/i.test(message)) {
                message = 'Missing business ID. The booking link appears to be invalid. Please scan the QR code again.';
            }
            if (/duplicate|already exists|unique/i.test(message)) {
                message = 'An account with this email already exists for this salon. Please login instead.';
            }
            if (/business.*not.*found|invalid.*business/i.test(message)) {
                message = 'The salon associated with this QR code was not found. Please contact the salon.';
            }
            throw new Error(message);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Registration failed');
        }
        
        // Store customer info and show booking form
        localStorage.setItem('customerUser', JSON.stringify(result.customer));
        localStorage.setItem('userType', 'customer');
        currentUserId = result.customer.id;
        
        showBookingForm(result.customer);
        
    } catch (error) {
        console.error('Registration error:', error);
        alert('Error creating account: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}
// Function for appointment booking form
function initNotificationSystem() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationPanel = document.getElementById('notificationPanel');
    const clearNotificationsBtn = document.getElementById('clearNotifications');
    
    if (notificationBtn && notificationPanel) {
        notificationBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationPanel.classList.toggle('active');
            markAllNotificationsAsRead();
            updateNotificationBadge();
        });
        
        // Close notification panel when clicking outside
        document.addEventListener('click', function(e) {
            if (!notificationPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
                notificationPanel.classList.remove('active');
            }
        });
    }
    
    if (clearNotificationsBtn) {
        clearNotificationsBtn.addEventListener('click', clearAllNotifications);
    }
    
    updateNotificationDisplay();
}
function addNotification(title, message, type = 'info') {
    const notification = {
        id: Date.now().toString(),
        title,
        message,
        type,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    notifications.unshift(notification);
    if (notifications.length > 50) {
        notifications = notifications.slice(0, 50);
    }
    
    localStorage.setItem('businessNotifications', JSON.stringify(notifications));
    updateNotificationDisplay();
    updateNotificationBadge();
    
    // Show desktop notification if supported
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: message, icon: '/favicon.ico' });
    }
}
function updateNotificationDisplay() {
    const notificationList = document.getElementById('notificationList');
    if (!notificationList) return;
    
    if (notifications.length === 0) {
        notificationList.innerHTML = `
            <div class="no-notifications">
                <i class="fas fa-bell-slash" style="font-size: 24px; margin-bottom: 10px;"></i>
                <p>No new notifications</p>
            </div>
        `;
        return;
    }
    
    notificationList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.read ? '' : 'unread'}" 
             onclick="handleNotificationClick('${notification.id}')">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">${formatTimeAgo(notification.timestamp)}</div>
        </div>
    `).join('');
}
function handleNotificationClick(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        localStorage.setItem('businessNotifications', JSON.stringify(notifications));
        updateNotificationDisplay();
        updateNotificationBadge();
        
        // Handle notification action
        if (notification.type === 'new_booking') {
            document.getElementById('notificationPanel').classList.remove('active');
            // Scroll to appointments section
            document.getElementById('appointmentsSection').scrollIntoView({ behavior: 'smooth' });
        }
    }
}
function markAllNotificationsAsRead() {
    notifications.forEach(notification => {
        notification.read = true;
    });
    localStorage.setItem('businessNotifications', JSON.stringify(notifications));
    updateNotificationDisplay();
    updateNotificationBadge();
}

function clearAllNotifications() {
    if (confirm('Are you sure you want to clear all notifications?')) {
        notifications = [];
        localStorage.setItem('businessNotifications', JSON.stringify(notifications));
        updateNotificationDisplay();
        updateNotificationBadge();
    }
}
function updateNotificationBadge() {
    const badge = document.getElementById('headerNotificationBadge');
    if (!badge) return;
    
    const unreadCount = notifications.filter(n => !n.read).length;
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}
// Enhanced Appointments Management
function initEnhancedAppointments() {
    // Date range filter with null checks
    const dateRange = document.getElementById('dateRange');
    const customDateRange = document.getElementById('customDateRange');
    const customDateRangeEnd = document.getElementById('customDateRangeEnd');
    
    if (dateRange && customDateRange && customDateRangeEnd) {
        dateRange.addEventListener('change', function() {
            if (this.value === 'custom') {
                customDateRange.style.display = 'flex';
                customDateRangeEnd.style.display = 'flex';
            } else {
                customDateRange.style.display = 'none';
                customDateRangeEnd.style.display = 'none';
                loadAppointments();
            }
        });
    }
    
    // Custom date range listeners with null checks
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    if (startDate && endDate) {
        startDate.addEventListener('change', loadAppointments);
        endDate.addEventListener('change', loadAppointments);
    }
    
    // Export functionality with null check
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportAppointments);
    }
    
    // Pagination with null checks
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    if (prevPage && nextPage) {
        prevPage.addEventListener('click', () => changePage(-1));
        nextPage.addEventListener('click', () => changePage(1));
    }
    
    // Select all functionality with null check
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('#appointmentsTbody input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });
    }
    
    // Request notification permission
    if ("Notification" in window) {
        Notification.requestPermission();
    }
}
function changePage(direction) {
    currentPage += direction;
    if (currentPage < 1) currentPage = 1;
    loadAppointments();
}
function showBookingForm(user) {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('bookingSection').classList.remove('hidden');
    document.getElementById('userName').textContent = user.name;
    
    // Load services for booking
    loadServicesForBooking();

    // Wire up appointment booking submission
    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            try {
                const serviceSelect = document.getElementById('service');
                const serviceId = serviceSelect ? serviceSelect.value : '';
                const appointmentDate = document.getElementById('appointmentDate').value;
                const notes = document.getElementById('notes').value;

                if (!serviceId) {
                    alert('Please select a service');
                    return;
                }

                const appointmentData = {
                    businessId: currentBusinessId,
                    userId: currentUserId, // backend will accept scalar id
                    serviceId: serviceId,
                    appointmentDate: appointmentDate,
                    notes: notes
                };

                const appointment = await handleAppointmentBooking(appointmentData);

                if (appointment) {
                    document.getElementById('bookingSection').classList.add('hidden');
                    document.getElementById('confirmationMessage').classList.remove('hidden');
                }
            } catch (err) {
                console.error('Booking failed:', err);
                alert('Error booking appointment: ' + err.message);
            }
        });
    }
}

// Service Management Functions
async function loadBusinessServices(businessId) {
    try {
        const response = await fetch(`/api/services?businessId=${businessId}`);
        const result = await response.json();
        
        if (response.ok) {
            return result.services || [];
        } else {
            console.error('Error loading services:', result.error);
            return [];
        }
    } catch (error) {
        console.error('Error loading services:', error);
        return [];
    }
}

async function createService(serviceData) {
    try {
        const response = await fetch('/api/services', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(serviceData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            return result.service;
        } else {
            throw new Error(result.error || 'Failed to create service');
        }
    } catch (error) {
        console.error('Error creating service:', error);
        throw error;
    }
}

// Function for loading services into booking form
async function loadServicesForBooking() {
    if (!currentBusinessId) {
        console.error('No business ID available');
        return;
    }

    try {
        // Load services
        const services = await loadBusinessServices(currentBusinessId);
        const serviceSelect = document.getElementById('service');
        
        if (serviceSelect) {
            serviceSelect.innerHTML = '<option value="">Choose a service</option>';
            
            services.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = `${service.name} - R${service.price} (${service.duration} min)`;
                option.setAttribute('data-price', service.price);
                option.setAttribute('data-duration', service.duration);
                serviceSelect.appendChild(option);
            });
            
            businessServices = services;
        }

        // Load stylists
        const stylists = await loadBusinessStylists(currentBusinessId);
        const stylistSelect = document.getElementById('stylist');
        
        if (stylistSelect) {
            stylistSelect.innerHTML = '<option value="">Any available stylist</option>';
            
            stylists
                .filter(stylist => stylist.is_active)
                .forEach(stylist => {
                    const option = document.createElement('option');
                    option.value = stylist.id;
                    option.textContent = stylist.name + (stylist.specialization ? ` - ${stylist.specialization}` : '');
                    stylistSelect.appendChild(option);
                });
        }

    } catch (error) {
        console.error('Error loading services/stylists for booking:', error);
    }
}

// Service Management Functions
function initServiceManagement() {
    const addServiceBtn = document.getElementById('addServiceBtn');
    const serviceModal = document.getElementById('serviceModal');
    const serviceForm = document.getElementById('serviceForm');
    const cancelServiceBtn = document.getElementById('cancelService');
    const closeModalBtn = serviceModal?.querySelector('.close');

    // Open modal when Add Service button is clicked
    if (addServiceBtn) {
        addServiceBtn.addEventListener('click', function() {
            openServiceModal();
        });
    }

    // Close modal when close button is clicked
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            closeServiceModal();
        });
    }

    // Close modal when cancel button is clicked
    if (cancelServiceBtn) {
        cancelServiceBtn.addEventListener('click', function() {
            closeServiceModal();
        });
    }

    // Close modal when clicking outside
    if (serviceModal) {
        serviceModal.addEventListener('click', function(e) {
            if (e.target === serviceModal) {
                closeServiceModal();
            }
        });
    }

    // Handle form submission
    if (serviceForm) {
        serviceForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleServiceFormSubmit();
        });
    }

    // Load services when page loads
    loadServices();
}

function openServiceModal(service = null) {
    const modal = document.getElementById('serviceModal');
    const modalTitle = document.getElementById('serviceModalTitle');
    const form = document.getElementById('serviceForm');
    const editingServiceIdEl = document.getElementById('editingServiceId');

    if (service) {
        // Editing existing service
        modalTitle.textContent = 'Edit Service';
        document.getElementById('serviceName').value = service.name;
        document.getElementById('serviceDescription').value = service.description || '';
        document.getElementById('servicePrice').value = service.price;
        document.getElementById('serviceDuration').value = service.duration;
        if (editingServiceIdEl) editingServiceIdEl.value = service.id;
    } else {
        // Adding new service
        modalTitle.textContent = 'Add New Service';
        form.reset();
        if (editingServiceIdEl) editingServiceIdEl.value = '';
    }

    // Show modal
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

function closeServiceModal() {
    const modal = document.getElementById('serviceModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

async function handleServiceFormSubmit() {
    const form = document.getElementById('serviceForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    try {
        const serviceData = {
            businessId: currentBusinessId,
            name: document.getElementById('serviceName').value,
            description: document.getElementById('serviceDescription').value,
            price: parseFloat(document.getElementById('servicePrice').value),
            duration: parseInt(document.getElementById('serviceDuration').value)
        };

        const editingServiceIdEl = document.getElementById('editingServiceId');
        const editingServiceId = editingServiceIdEl ? editingServiceIdEl.value : '';
        let result;

        if (editingServiceId) {
            // Update existing service
            result = await updateService(editingServiceId, serviceData);
        } else {
            // Create new service
            result = await createService(serviceData);
        }

        if (result) {
            closeServiceModal();
            await loadServices(); // Reload the services list
            showNotification('Service saved successfully!', 'success');
        }

    } catch (error) {
        console.error('Error saving service:', error);
        showNotification('Error saving service: ' + error.message, 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

async function loadServices() {
    const servicesList = document.getElementById('servicesList');
    if (!servicesList) return;

    try {
        servicesList.innerHTML = '<div class="loading">Loading services...</div>';
        
        const services = await loadBusinessServices(currentBusinessId);
        
        if (services.length === 0) {
            servicesList.innerHTML = `
                <div class="no-services">
                    <p>No services added yet.</p>
                    <p>Click "Add New Service" to get started!</p>
                </div>
            `;
            return;
        }

        servicesList.innerHTML = '';
        
        services.forEach(service => {
            const serviceItem = document.createElement('div');
            serviceItem.className = 'service-item';
            serviceItem.innerHTML = `
                <div class="service-info">
                    <h3>${service.name}</h3>
                    ${service.description ? `<p>${service.description}</p>` : ''}
                    <div class="service-meta">
                        <span class="service-price">R${service.price}</span>
                        <span class="service-duration">${service.duration} minutes</span>
                    </div>
                </div>
                <div class="service-actions">
                    <button class="service-action-btn service-edit" onclick="editService('${service.id}')">
                        Edit
                    </button>
                    <button class="service-action-btn service-delete" onclick="deleteService('${service.id}')">
                        Delete
                    </button>
                </div>
            `;
            servicesList.appendChild(serviceItem);
        });

    } catch (error) {
        console.error('Error loading services:', error);
        servicesList.innerHTML = '<div class="error">Error loading services. Please try again.</div>';
    }
}

async function editService(serviceId) {
    try {
        const services = await loadBusinessServices(currentBusinessId);
        const service = services.find(s => s.id === serviceId);
        
        if (service) {
            openServiceModal(service);
        } else {
            throw new Error('Service not found');
        }
    } catch (error) {
        console.error('Error editing service:', error);
        showNotification('Error loading service details', 'error');
    }
}

async function deleteService(serviceId) {
    if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
        return;
    }

    try {
        const serviceItem = document.querySelector(`[onclick="editService('${serviceId}')"]`)?.closest('.service-item');
        if (serviceItem) {
            serviceItem.classList.add('loading');
        }

        const response = await fetch(`/api/services?id=${serviceId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            await loadServices(); // Reload the services list
            showNotification('Service deleted successfully!', 'success');
        } else {
            throw new Error(result.error || 'Failed to delete service');
        }

    } catch (error) {
        console.error('Error deleting service:', error);
        showNotification('Error deleting service: ' + error.message, 'error');
    }
}

async function updateService(serviceId, serviceData) {
    try {
        const response = await fetch('/api/services', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: serviceId,
                ...serviceData
            })
        });

        const result = await response.json();

        if (response.ok) {
            return result.service;
        } else {
            throw new Error(result.error || 'Failed to update service');
        }
    } catch (error) {
        console.error('Error updating service:', error);
        throw error;
    }
}

// STYLIST MANAGEMENT FUNCTIONS - COMPLETELY REWRITTEN
function initStylistManagement() {
    console.log('Initializing stylist management...');
    
    const addStylistBtn = document.getElementById('addStylistBtn');
    const stylistModal = document.getElementById('stylistModal');
    const stylistForm = document.getElementById('stylistForm');
    const cancelStylistBtn = document.getElementById('cancelStylist');
    const closeModalBtn = stylistModal?.querySelector('.close');

    console.log('Stylist elements found:', {
        addStylistBtn: !!addStylistBtn,
        stylistModal: !!stylistModal,
        stylistForm: !!stylistForm,
        cancelStylistBtn: !!cancelStylistBtn,
        closeModalBtn: !!closeModalBtn
    });

    // Open modal when Add Stylist button is clicked
    if (addStylistBtn) {
        addStylistBtn.addEventListener('click', function() {
            console.log('Add Stylist button clicked');
            openStylistModal();
        });
    } else {
        console.error('Add Stylist button not found!');
    }

    // Close modal when close button is clicked
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            closeStylistModal();
        });
    }

    // Close modal when cancel button is clicked
    if (cancelStylistBtn) {
        cancelStylistBtn.addEventListener('click', function() {
            closeStylistModal();
        });
    }

    // Close modal when clicking outside
    if (stylistModal) {
        stylistModal.addEventListener('click', function(e) {
            if (e.target === stylistModal) {
                closeStylistModal();
            }
        });
    }

    // Handle form submission
    if (stylistForm) {
        stylistForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleStylistFormSubmit();
        });
    }

    // Load stylists when page loads
    loadStylists();
}

function openStylistModal(stylist = null) {
    console.log('Opening stylist modal...');
    
    const modal = document.getElementById('stylistModal');
    const modalTitle = document.getElementById('stylistModalTitle');
    const form = document.getElementById('stylistForm');
    const editingStylistId = document.getElementById('editingStylistId');

    if (!modal) {
        console.error('Stylist modal not found!');
        return;
    }

    if (stylist) {
        // Editing existing stylist
        console.log('Editing stylist:', stylist);
        modalTitle.textContent = 'Edit Stylist';
        document.getElementById('stylistName').value = stylist.name;
        document.getElementById('stylistEmail').value = stylist.email || '';
        document.getElementById('stylistPhone').value = stylist.phone || '';
        document.getElementById('stylistSpecialization').value = stylist.specialization || '';
        document.getElementById('stylistBio').value = stylist.bio || '';
        document.getElementById('stylistImageUrl').value = stylist.image_url || '';
        document.getElementById('stylistActive').checked = stylist.is_active !== false;
        if (editingStylistId) editingStylistId.value = stylist.id;
    } else {
        // Adding new stylist
        console.log('Adding new stylist');
        modalTitle.textContent = 'Add New Stylist';
        if (form) form.reset();
        if (document.getElementById('stylistActive')) {
            document.getElementById('stylistActive').checked = true;
        }
        if (editingStylistId) editingStylistId.value = '';
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    console.log('Stylist modal should be visible now');
}

function closeStylistModal() {
    const modal = document.getElementById('stylistModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

async function handleStylistFormSubmit() {
    console.log('Handling stylist form submission...');
    
    const form = document.getElementById('stylistForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    try {
        const stylistData = {
            businessId: currentBusinessId,
            name: document.getElementById('stylistName').value,
            email: document.getElementById('stylistEmail').value,
            phone: document.getElementById('stylistPhone').value,
            specialization: document.getElementById('stylistSpecialization').value,
            bio: document.getElementById('stylistBio').value,
            imageUrl: document.getElementById('stylistImageUrl').value,
            isActive: document.getElementById('stylistActive').checked
        };

        console.log('Stylist data to save:', stylistData);

        const editingStylistId = document.getElementById('editingStylistId').value;
        let result;

        if (editingStylistId) {
            // Update existing stylist
            console.log('Updating stylist with ID:', editingStylistId);
            result = await updateStylist(editingStylistId, stylistData);
        } else {
            // Create new stylist
            console.log('Creating new stylist');
            result = await createStylist(stylistData);
        }

        if (result) {
            closeStylistModal();
            await loadStylists(); // Reload the stylists list
            showNotification('Stylist saved successfully!', 'success');
        }

    } catch (error) {
        console.error('Error saving stylist:', error);
        showNotification('Error saving stylist: ' + error.message, 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

async function loadStylists() {
    const stylistsList = document.getElementById('stylistsList');
    if (!stylistsList) {
        console.log('Stylists list container not found');
        return;
    }

    try {
        stylistsList.innerHTML = '<div class="loading">Loading stylists...</div>';
        
        const stylists = await loadBusinessStylists(currentBusinessId);
        console.log('Loaded stylists:', stylists);
        
        if (stylists.length === 0) {
            stylistsList.innerHTML = `
                <div class="no-stylists">
                    <p>No stylists added yet.</p>
                    <p>Click "Add New Stylist" to get started!</p>
                </div>
            `;
            return;
        }

        stylistsList.innerHTML = '';
        
        stylists.forEach(stylist => {
            const stylistCard = document.createElement('div');
            stylistCard.className = 'stylist-card';
            
            const firstName = stylist.name.split(' ')[0];
            const avatarContent = stylist.image_url 
                ? `<img src="${stylist.image_url}" alt="${stylist.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='${firstName.charAt(0).toUpperCase()}'">`
                : firstName.charAt(0).toUpperCase();
            
            stylistCard.innerHTML = `
                <div class="stylist-header">
                    <div class="stylist-avatar ${stylist.image_url ? 'has-image' : ''}">
                        ${avatarContent}
                    </div>
                    <div class="stylist-info">
                        <div class="stylist-name">${stylist.name}</div>
                        ${stylist.specialization ? `<div class="stylist-specialization">${stylist.specialization}</div>` : ''}
                        ${stylist.email ? `<div class="stylist-contact">${stylist.email}</div>` : ''}
                        ${stylist.phone ? `<div class="stylist-contact">${stylist.phone}</div>` : ''}
                        <div class="stylist-status ${stylist.is_active ? 'active' : 'inactive'}">
                            <span class="stylist-status-dot"></span>
                            ${stylist.is_active ? 'Active' : 'Inactive'}
                        </div>
                    </div>
                </div>
                ${stylist.bio ? `<div class="stylist-bio">${stylist.bio}</div>` : ''}
                <div class="stylist-actions">
                    <button class="stylist-action-btn stylist-edit" onclick="editStylist('${stylist.id}')">
                        Edit
                    </button>
                    <button class="stylist-action-btn stylist-delete" onclick="deleteStylist('${stylist.id}')">
                        Delete
                    </button>
                </div>
            `;
            stylistsList.appendChild(stylistCard);
        });

    } catch (error) {
        console.error('Error loading stylists:', error);
        stylistsList.innerHTML = '<div class="error">Error loading stylists. Please try again.</div>';
    }
}

async function editStylist(stylistId) {
    try {
        const stylists = await loadBusinessStylists(currentBusinessId);
        const stylist = stylists.find(s => s.id === stylistId);
        
        if (stylist) {
            openStylistModal(stylist);
        } else {
            throw new Error('Stylist not found');
        }
    } catch (error) {
        console.error('Error editing stylist:', error);
        showNotification('Error loading stylist details', 'error');
    }
}

async function deleteStylist(stylistId) {
    if (!confirm('Are you sure you want to delete this stylist? This action cannot be undone.')) {
        return;
    }

    try {
        const stylistCard = document.querySelector(`[onclick="editStylist('${stylistId}')"]`)?.closest('.stylist-card');
        if (stylistCard) {
            stylistCard.classList.add('loading');
        }

        const response = await fetch(`/api/stylists?id=${stylistId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            await loadStylists(); // Reload the stylists list
            showNotification('Stylist deleted successfully!', 'success');
        } else {
            throw new Error(result.error || 'Failed to delete stylist');
        }

    } catch (error) {
        console.error('Error deleting stylist:', error);
        showNotification('Error deleting stylist: ' + error.message, 'error');
    }
}

// API Functions for Stylists
async function loadBusinessStylists(businessId) {
    try {
        const response = await fetch(`/api/stylists?businessId=${businessId}`);
        const result = await response.json();
        
        if (response.ok) {
            return result.stylists || [];
        } else {
            console.error('Error loading stylists:', result.error);
            return [];
        }
    } catch (error) {
        console.error('Error loading stylists:', error);
        return [];
    }
}

async function createStylist(stylistData) {
    try {
        const response = await fetch('/api/stylists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(stylistData)
        });

        const result = await response.json();

        if (response.ok) {
            return result.stylist;
        } else {
            throw new Error(result.error || 'Failed to create stylist');
        }
    } catch (error) {
        console.error('Error creating stylist:', error);
        throw error;
    }
}

async function updateStylist(stylistId, stylistData) {
    try {
        const response = await fetch('/api/stylists', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: stylistId,
                ...stylistData
            })
        });

        const result = await response.json();

        if (response.ok) {
            return result.stylist;
        } else {
            throw new Error(result.error || 'Failed to update stylist');
        }
    } catch (error) {
        console.error('Error updating stylist:', error);
        throw error;
    }
}

// Utility function for notifications
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles for notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    
    if (type === 'success') {
        notification.style.backgroundColor = '#4caf50';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
    } else {
        notification.style.backgroundColor = '#ff9800';
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add these animations to your CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

async function handleAppointmentBooking(appointmentData) {
    try {
        const response = await fetch('/api/appointments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(appointmentData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            return result.appointment;
        } else {
            throw new Error(result.error || 'Failed to book appointment');
        }
    } catch (error) {
        console.error('Error booking appointment:', error);
        throw error;
    }
}

// Update the DOM Content Loaded function
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing application');
    
    // Business Registration Page
    if (document.getElementById('businessForm')) {
        console.log('Initializing business registration');
        initBusinessAuthentication();
        initBusinessRegistration();
        handleBusinessLoginRedirect(); 
    }
    
    // Customer Booking Page
    if (document.getElementById('authSection')) {
        console.log('Initializing customer authentication');
        initCustomerAuthentication();
        
        // Get business ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        currentBusinessId = urlParams.get('business');
        
        if (!currentBusinessId) {
            // If no business ID, check if user is trying to login as business
            const userType = localStorage.getItem('userType');
            const businessUser = localStorage.getItem('businessUser');
            
            if (userType === 'business' && businessUser) {
                // Redirect to business dashboard
                const user = JSON.parse(businessUser);
                window.location.href = `business.html?id=${user.id}`;
                return;
            }
            
            // Show business login tab by default if no business ID
            const businessTab = document.querySelector('[data-tab="business"]');
            if (businessTab) businessTab.click();
        } else {
            // Load business info if business ID is present
            loadBusinessInfo();
            
            // Check if customer is already logged in
            const customerUser = localStorage.getItem('customerUser');
            const userType = localStorage.getItem('userType');
            
            if (customerUser && userType === 'customer' && currentBusinessId) {
                const user = JSON.parse(customerUser);
                // Verify this customer belongs to the current business
                if (user.business_id === currentBusinessId) {
                    currentUserId = user.id;
                    showBookingForm(user);
                }
            }
        }
        
        // Check if business user is already logged in
        const businessUser = localStorage.getItem('businessUser');
        const userType = localStorage.getItem('userType');
        
        if (businessUser && userType === 'business') {
            const user = JSON.parse(businessUser);
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('businessRedirect').classList.remove('hidden');
        }
    }
    
    // Business Dashboard
    if (document.getElementById('dashboardTitle')) {
        console.log('Initializing business dashboard');
        initBusinessDashboard();
        initNotificationSystem();
        initEnhancedAppointments();
        
        // Check if business user is logged in
        const businessUser = localStorage.getItem('businessUser');
        const userType = localStorage.getItem('userType');
        
        if (businessUser && userType === 'business') {
            const user = JSON.parse(businessUser);
            const urlParams = new URLSearchParams(window.location.search);
            const businessId = urlParams.get('id');
            
            // Verify the logged-in business owns this dashboard
            if (user.id === businessId) {
                currentBusinessId = businessId;
                initializeDashboard(user);
                loadBusinessData();
                loadAppointments();
                loadServices(); // Load services when dashboard loads
                loadStylists(); // Load stylists when dashboard loads
            } else {
                alert('Access denied');
                window.location.href = 'customer.html?type=business';
            }
        } else {
            alert('Please login first');
            window.location.href = 'customer.html?type=business';
        }
    }
});

// Business Dashboard Functions
function initializeDashboard(businessUser) {
    const sidebarName = document.getElementById('sidebarSalonName');
    if (sidebarName) sidebarName.textContent = businessUser.name;
    const title = document.getElementById('dashboardTitle');
    if (title) title.textContent = businessUser.name + ' Dashboard';
    const owner = document.getElementById('dashboardOwnerName');
    if (owner) owner.textContent = (businessUser.name || '').split(' ')[0] || 'Owner';
}

function initBusinessDashboard() {
    const refreshBtn = document.getElementById('refreshBtn');
    const qrBtn = document.getElementById('qrBtn');
    const closeModal = document.querySelector('.close');
    const modal = document.getElementById('qrModal');
    
    // Get business ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentBusinessId = urlParams.get('id');
    
    if (!currentBusinessId) {
        alert('Invalid business dashboard link');
        return;
    }
    
    // Load business data
    loadBusinessData();
    loadAppointments();

    // Set current date display
    const currentDateEl = document.getElementById('currentDate');
    if (currentDateEl) {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        currentDateEl.textContent = now.toLocaleDateString('en-US', options);
    }
    
    // Initialize service management
    initServiceManagement();
    
    // Initialize stylist management
    initStylistManagement();
    
    // Logout
    const logoutEl = document.querySelector('.logout-btn');
    if (logoutEl) {
        logoutEl.addEventListener('click', function() {
            localStorage.removeItem('businessUser');
            localStorage.removeItem('userType');
            window.location.href = 'customer.html?type=business';
        });
    }

    // Filters
    const datePicker = document.getElementById('datePicker');
    const stylistFilter = document.getElementById('stylistFilter');
    const statusFilter = document.getElementById('statusFilter');
    [datePicker, stylistFilter, statusFilter].forEach(el => {
        if (el) el.addEventListener('change', () => loadAppointments());
    });

    // Confirmation modal handler
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const confirmationModal = document.getElementById('confirmationModal');
    if (modalConfirmBtn && confirmationModal) {
        modalConfirmBtn.addEventListener('click', async function() {
            const aptId = confirmationModal.dataset.appointmentId;
            if (!aptId) {
                confirmationModal.style.display = 'none';
                return;
            }
            try {
                const resp = await fetch('/api/appointments', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: aptId, status: 'confirmed' })
                });
                if (resp.ok) {
                    confirmationModal.style.display = 'none';
                    loadAppointments();
                } else {
                    alert('Error confirming appointment');
                }
            } catch (e) {
                console.error('Confirm error', e);
            }
        });
    }
    
    // Close modals by clicking X
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirmationModal) confirmationModal.style.display = 'none';
        });
    });

    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadAppointments();
        });
    }
    
    // QR code button
    if (qrBtn) {
        qrBtn.addEventListener('click', async function() {
            try {
                const response = await fetch('/api/qrcode', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ businessId: currentBusinessId })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    document.getElementById('modalQrCode').innerHTML = `<img src="${result.qrCode}" alt="QR Code">`;
                    modal.classList.remove('hidden');
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error generating QR code: ' + error.message);
            }
        });
    }
    
    // Close modal
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            modal.classList.add('hidden');
        });
    }
    
    // Close modal when clicking outside
    if (modal) {
        window.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
}

async function loadBusinessData() {
    try {
        const response = await fetch(`/api/business?id=${currentBusinessId}`);
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('dashboardTitle').textContent = result.business.name + " Dashboard";
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error loading business data: ' + error.message);
    }
}

async function loadAppointments() {
    try {
        // Get filter values safely with null checks
        const dateRange = document.getElementById('dateRange');
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        const stylistFilter = document.getElementById('stylistFilter');
        const statusFilter = document.getElementById('statusFilter');
        
        let url = `/api/appointments?businessId=${currentBusinessId}&page=${currentPage}&limit=${appointmentsPerPage}`;
        
        // Add filters to URL safely
        const params = new URLSearchParams();
        
        // Date range filter with null checks
        if (dateRange && dateRange.value === 'custom' && startDate && startDate.value && endDate && endDate.value) {
            params.append('startDate', startDate.value);
            params.append('endDate', endDate.value);
        } else if (dateRange && dateRange.value !== 'custom') {
            params.append('dateRange', dateRange.value);
        }
        
        if (stylistFilter && stylistFilter.value !== 'all') params.append('stylist', stylistFilter.value);
        if (statusFilter && statusFilter.value !== 'all') params.append('status', statusFilter.value);
        
        if (params.toString()) {
            url += '&' + params.toString();
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (response.ok) {
            displayEnhancedAppointments(result.appointments || []);
            updateAppointmentSummary(result.appointments || []);
            updatePagination(result.totalCount || result.appointments.length);
        } else {
            console.error('Error loading appointments:', result.error);
        }
    } catch (error) {
        console.error('Error loading appointments:', error);
    }
}
function displayEnhancedAppointments(appointments) {
    const tbody = document.getElementById('appointmentsTbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (appointments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px;">
                    <i class="fas fa-calendar-times" style="font-size: 48px; color: var(--gray); margin-bottom: 15px;"></i>
                    <p>No appointments found</p>
                    <p style="font-size: 14px; color: var(--gray);">Try adjusting your filters</p>
                </td>
            </tr>
        `;
        return;
    }
    
    appointments.forEach(appointment => {
        const row = document.createElement('tr');
        const appointmentDate = new Date(appointment.appointment_date);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }) + ' at ' + appointmentDate.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const customerName = appointment.customers ? appointment.customers.name : 'N/A';
        const avatarLetter = customerName.charAt(0).toUpperCase();
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="appointment-checkbox" value="${appointment.id}">
            </td>
            <td>
                <div class="customer-cell">
                    <div class="customer-avatar">${avatarLetter}</div>
                    <div>
                        <div class="customer-name">${customerName}</div>
                        <div class="customer-email">${appointment.customers ? appointment.customers.email : 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="service-info">
                    <div class="service-name">${appointment.service}</div>
                    ${appointment.services ? `<div class="service-price">R${appointment.services.price}</div>` : ''}
                </div>
            </td>
            <td>${appointment.stylist || 'Not assigned'}</td>
            <td>
                <div class="datetime-info">
                    <div class="date">${formattedDate}</div>
                    <div class="time-ago">${formatTimeAgo(appointment.appointment_date)}</div>
                </div>
            </td>
            <td>
                <div class="contact-info">
                    <div class="phone">${appointment.customers ? appointment.customers.phone : 'N/A'}</div>
                    <div class="email">${appointment.customers ? appointment.customers.email : 'N/A'}</div>
                </div>
            </td>
            <td>
                <span class="status-badge status-${appointment.status}">
                    ${appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    ${appointment.status === 'pending' ? 
                        `<button class="action-btn btn-confirm" data-appointment-id="${appointment.id}">
                            <i class="fas fa-check"></i> Confirm
                        </button>` : ''}
                    <button class="action-btn btn-edit" data-appointment-id="${appointment.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn btn-cancel" data-appointment-id="${appointment.id}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Attach event listeners
    attachAppointmentEventListeners();
}
function updateAppointmentSummary(appointments) {
    const pendingCount = appointments.filter(apt => apt.status === 'pending').length;
    const confirmedCount = appointments.filter(apt => apt.status === 'confirmed').length;
    const totalCount = appointments.length;
    
    document.getElementById('pendingCount').textContent = pendingCount;
    document.getElementById('confirmedCount').textContent = confirmedCount;
    document.getElementById('totalCount').textContent = totalCount;
}

function updatePagination(totalCount) {
    const totalPages = Math.ceil(totalCount / appointmentsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    if (prevPage) {
        prevPage.disabled = currentPage === 1;
    }
    
    if (nextPage) {
        nextPage.disabled = currentPage === totalPages;
    }
}
function attachAppointmentEventListeners() {
    // Confirm buttons
    document.querySelectorAll('.btn-confirm').forEach(button => {
        button.addEventListener('click', function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            confirmAppointment(appointmentId);
        });
    });
    
    // Edit buttons
    document.querySelectorAll('.btn-edit').forEach(button => {
        button.addEventListener('click', function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            editAppointment(appointmentId);
        });
    });
    
    // Cancel buttons
    document.querySelectorAll('.btn-cancel').forEach(button => {
        button.addEventListener('click', function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            cancelAppointment(appointmentId);
        });
    });
}
async function confirmAppointment(appointmentId) {
    try {
        const response = await fetch('/api/appointments', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: appointmentId, status: 'confirmed' })
        });
        
        if (response.ok) {
            loadAppointments();
            addNotification('Appointment Confirmed', 'Appointment has been confirmed successfully', 'success');
        } else {
            alert('Error confirming appointment');
        }
    } catch (error) {
        console.error('Error confirming appointment:', error);
        alert('Error confirming appointment');
    }
}
async function cancelAppointment(appointmentId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    
    try {
        const response = await fetch('/api/appointments', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: appointmentId, status: 'cancelled' })
        });
        
        if (response.ok) {
            loadAppointments();
            addNotification('Appointment Cancelled', 'Appointment has been cancelled', 'warning');
        } else {
            alert('Error cancelling appointment');
        }
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        alert('Error cancelling appointment');
    }
}
function editAppointment(appointmentId) {
    // Implement edit functionality
   loadAppointments().then(() => {
        const appointment = appointments.find(apt => apt.id === appointmentId);

        if (appointment) {
            // Populate the booking form with appointment details
            document.getElementById('editAppointmentId').value = appointment.id;
            document.getElementById('editCustomerName').value = appointment.customers.name;
            document.getElementById('editService').value = appointment.service;
            document.getElementById('editStylist').value = appointment.stylist;
            document.getElementById('editAppointmentDate').value = appointment.appointment_date;
            document.getElementById('editAppointmentNotes').value = appointment.notes;

            // Show the edit modal
            document.getElementById('editAppointmentModal').style.display = 'block';
       } else {
         alert('Appointment not found');
         }
    });
}

function exportAppointments() {
    // Implement export functionality
   loadAppointments().then(() => {
        if (appointments.length === 0) {
            alert('No appointments to export');
            return;
        }

        const headers = ['Customer Name', 'Service', 'Stylist', 'Appointment Date', 'Phone', 'Email', 'Status', 'Notes'];
        const rows = appointments.map(apt => {
            const appointmentDate = new Date(apt.appointment_date);
            const formattedDate = appointmentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' at ' + appointmentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const customerName = apt.customers ? apt.customers.name : 'N/A';
            const phone = apt.customers ? apt.customers.phone : 'N/A';
            const email = apt.customers ? apt.customers.email : 'N/A';
            return [
                customerName,
                apt.service,
                apt.stylist || 'Not assigned',
                formattedDate,
                phone,
                email,
                apt.status.charAt(0).toUpperCase() + apt.status.slice(1),
                apt.notes || ''
            ];
        });

        let csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n"
            + rows.map(e => e.map(field => `"${field.replace(/"/g, '""')}"`).join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "appointments.csv");
        document.body.appendChild(link); // Required for FF

        link.click();
        document.body.removeChild(link);
    });
        
}

function displayAppointments(appointments) {
    // Card list view (if exists)
    const appointmentsList = document.getElementById('appointmentsList');
    if (appointmentsList) {
        appointmentsList.innerHTML = '';
        if (appointments.length === 0) {
            appointmentsList.innerHTML = '<p class="no-appointments">No appointments scheduled</p>';
        } else {
            appointments.forEach(appointment => {
                const appointmentItem = document.createElement('div');
                appointmentItem.className = 'appointment-item';
                const appointmentDate = new Date(appointment.appointment_date);
                const formattedDate = appointmentDate.toLocaleDateString() + ' ' + appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const userObj = appointment.customers || appointment.users;
                appointmentItem.innerHTML = `
                    <div class="appointment-info">
                        <h3>${appointment.service}</h3>
                        <p>Customer: ${userObj ? userObj.name : 'N/A'}</p>
                        <p>Date: ${formattedDate}</p>
                        <p>Phone: ${userObj ? userObj.phone : 'N/A'}</p>
                        ${appointment.notes ? `<p>Notes: ${appointment.notes}</p>` : ''}
                    </div>
                    <div class="appointment-actions">
                        <span class="status-badge status-${appointment.status}">${appointment.status}</span>
                        <div>
                            <button class="btn-secondary" onclick="updateAppointmentStatus('${appointment.id}', 'confirmed')">Confirm</button>
                            <button class="btn-secondary" onclick="updateAppointmentStatus('${appointment.id}', 'cancelled')">Cancel</button>
                        </div>
                    </div>
                `;
                appointmentsList.appendChild(appointmentItem);
            });
        }
        return;
    }

    // Table view (business.html)
    const tbody = document.getElementById('appointmentsTbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (appointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No appointments found</td></tr>';
        return;
    }

    appointments.forEach(appointment => {
        const row = document.createElement('tr');
        const appointmentDate = new Date(appointment.appointment_date);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' at ' + appointmentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const userObj = appointment.customers || appointment.users;
        const customerName = userObj ? userObj.name : 'N/A';
        const avatarLetter = customerName.charAt(0).toUpperCase();
        row.innerHTML = `
            <td>
                <div class="customer-cell">
                    <div class="customer-avatar">${avatarLetter}</div>
                    <div>${customerName}</div>
                </div>
            </td>
            <td>${appointment.service}</td>
            <td>${appointment.stylist || 'Not assigned'}</td>
            <td>${formattedDate}</td>
            <td>${userObj ? userObj.phone : 'N/A'}</td>
            <td>
                <span class="status-badge status-${appointment.status}">
                    ${appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                </span>
            </td>
            <td>
                ${appointment.status === 'pending' ? `<button class="action-btn btn-confirm" data-appointment-id="${appointment.id}">Confirm</button>` : ''}
                <button class="action-btn btn-cancel" data-appointment-id="${appointment.id}">Cancel</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Attach confirm buttons to open the modal if present
    const confirmationModal = document.getElementById('confirmationModal');
    const modalCustomer = document.getElementById('modalCustomer');
    const modalService = document.getElementById('modalService');
    const modalStylist = document.getElementById('modalStylist');
    const modalDateTime = document.getElementById('modalDateTime');

    document.querySelectorAll('.btn-confirm[data-appointment-id]').forEach(button => {
        button.addEventListener('click', function() {
            const row = this.closest('tr');
            if (row && confirmationModal) {
                if (modalCustomer) modalCustomer.textContent = row.querySelector('.customer-cell div:last-child')?.textContent || '';
                if (modalService) modalService.textContent = row.cells[1]?.textContent || '';
                if (modalStylist) modalStylist.textContent = row.cells[2]?.textContent || '';
                if (modalDateTime) modalDateTime.textContent = row.cells[3]?.textContent || '';
                confirmationModal.dataset.appointmentId = this.getAttribute('data-appointment-id');
                confirmationModal.style.display = 'flex';
            }
        });
    });
}

function updateStats(appointments) {
    const today = new Date().toDateString();
    const todayAppointments = appointments.filter(apt => 
        new Date(apt.appointment_date).toDateString() === today
    );
    
    const pendingAppointments = appointments.filter(apt => 
        apt.status === 'pending'
    );
    
    // Card dashboard ids
    const todayCount = document.getElementById('todayCount');
    const pendingCount = document.getElementById('pendingCount');
    const totalCount = document.getElementById('totalCount');
    if (todayCount) todayCount.textContent = todayAppointments.length;
    if (pendingCount) pendingCount.textContent = pendingAppointments.length;
    if (totalCount) totalCount.textContent = appointments.length;

    // Business.html ids
    const todaysAppointmentsCount = document.getElementById('todaysAppointmentsCount');
    const pendingAppointmentsCount = document.getElementById('pendingAppointmentsCount');
    const appointmentBadge = document.getElementById('appointmentBadge');
    if (todaysAppointmentsCount) todaysAppointmentsCount.textContent = todayAppointments.length;
    if (pendingAppointmentsCount) pendingAppointmentsCount.textContent = pendingAppointments.length;
    if (appointmentBadge) appointmentBadge.textContent = pendingAppointments.length;
}

async function updateAppointmentStatus(appointmentId, status) {
    try {
        const response = await fetch('/api/appointments', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: appointmentId, status })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            loadAppointments();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error updating appointment: ' + error.message);
    }
}