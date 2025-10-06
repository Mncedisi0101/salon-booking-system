// Global variables
let currentBusinessId = null;
let currentUserId = null;
let currentUserType = null;
let currentBusinessData = null;
let businessServices = [];
let userType = null; // 'customer' or 'business'

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
            const description = input.querySelector('.service-description').value;
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
        
        // Check if the response is successful
        if (!response.ok) {
            // If it's a 405 error, the API endpoint doesn't exist or is misconfigured
            if (response.status === 405) {
                throw new Error('API endpoint not configured properly. Please check server setup.');
            }
            
            // Try to get error message from response
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
        
        // Check if response is JSON
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
        
    } catch (error) {
        console.error('QR code generation error:', error);
        
        // Show fallback URL
        const qrCodeContainer = document.getElementById('qrCodeContainer');
        if (qrCodeContainer) {
            const fallbackUrl = `${window.location.protocol}//${window.location.host}/customer.html?business=${businessId}`;
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
// Add this function to script.js
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
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }
        
        const registerData = {
            type: 'customer_register',
            name: document.getElementById('registerName').value,
            email: document.getElementById('registerEmail').value,
            phone: document.getElementById('registerPhone').value,
            password: password,
            businessId: currentBusinessId
        };
        
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registerData)
        });
        
        if (!response.ok) {
            throw new Error(`Registration failed: ${response.status}`);
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

function showBookingForm(user) {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('bookingSection').classList.remove('hidden');
    document.getElementById('userName').textContent = user.name;
    
    // Load services for booking
    loadServicesForBooking();
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
    } catch (error) {
        console.error('Error loading services for booking:', error);
    }
}
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
            document.querySelector('[data-tab="business"]').click();
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
                loadBusinessData();
                loadAppointments();
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
// Customer Booking Functions
function initCustomerBooking() {
    const userForm = document.getElementById('userForm');
    const appointmentForm = document.getElementById('appointmentForm');
    const bookAnotherBtn = document.getElementById('bookAnother');
    
    // Get business ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentBusinessId = urlParams.get('business');
    
    if (!currentBusinessId) {
        alert('Invalid booking link');
        return;
    }
    
    // Load business information
    loadBusinessInfo();
    
    // User form submission
    if (userForm) {
        userForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const userData = {
                businessId: currentBusinessId,
                name: document.getElementById('userName').value,
                email: document.getElementById('userEmail').value,
                phone: document.getElementById('userPhone').value
            };
            
            try {
                currentUserId = userData.email;
                
                document.getElementById('userInfoForm').classList.add('hidden');
                document.getElementById('bookingForm').classList.remove('hidden');
                
                loadServices();
            } catch (error) {
                alert('Error: ' + error.message);
            }
        });
    }
    
    // Appointment form submission
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const appointmentData = {
                businessId: currentBusinessId,
                userId: currentUserId,
                service: document.getElementById('service').value,
                appointmentDate: document.getElementById('appointmentDate').value,
                notes: document.getElementById('notes').value
            };
            
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
                    document.getElementById('bookingForm').classList.add('hidden');
                    document.getElementById('confirmationMessage').classList.remove('hidden');
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error booking appointment: ' + error.message);
            }
        });
    }
    
    // Book another appointment
    if (bookAnotherBtn) {
        bookAnotherBtn.addEventListener('click', function() {
            document.getElementById('confirmationMessage').classList.add('hidden');
            document.getElementById('bookingForm').classList.remove('hidden');
            document.getElementById('appointmentForm').reset();
        });
    }
}

function loadBusinessInfo() {
    // In a real implementation, we would fetch business details from the API
    document.getElementById('businessTitle').textContent = "Salon Booking";
}

function loadServices() {
    const services = [
        { name: "Haircut", price: 30, duration: 30 },
        { name: "Hair Color", price: 80, duration: 120 },
        { name: "Manicure", price: 25, duration: 45 },
        { name: "Pedicure", price: 35, duration: 60 }
    ];
    
    const serviceSelect = document.getElementById('service');
    if (serviceSelect) {
        serviceSelect.innerHTML = '<option value="">Choose a service</option>';
        
        services.forEach(service => {
            const option = document.createElement('option');
            option.value = service.name;
            option.textContent = `${service.name} - $${service.price} (${service.duration} min)`;
            serviceSelect.appendChild(option);
        });
        
        businessServices = services;
    }
}

// Business Dashboard Functions
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
        const response = await fetch(`/api/appointments?businessId=${currentBusinessId}`);
        const result = await response.json();
        
        if (response.ok) {
            displayAppointments(result.appointments || []);
            updateStats(result.appointments || []);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error loading appointments: ' + error.message);
    }
}

function displayAppointments(appointments) {
    const appointmentsList = document.getElementById('appointmentsList');
    if (!appointmentsList) return;
    
    appointmentsList.innerHTML = '';
    
    if (appointments.length === 0) {
        appointmentsList.innerHTML = '<p class="no-appointments">No appointments scheduled</p>';
        return;
    }
    
    appointments.forEach(appointment => {
        const appointmentItem = document.createElement('div');
        appointmentItem.className = 'appointment-item';
        
        const appointmentDate = new Date(appointment.appointment_date);
        const formattedDate = appointmentDate.toLocaleDateString() + ' ' + appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        appointmentItem.innerHTML = `
            <div class="appointment-info">
                <h3>${appointment.service}</h3>
                <p>Customer: ${appointment.users ? appointment.users.name : 'N/A'}</p>
                <p>Date: ${formattedDate}</p>
                <p>Phone: ${appointment.users ? appointment.users.phone : 'N/A'}</p>
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

function updateStats(appointments) {
    const today = new Date().toDateString();
    const todayAppointments = appointments.filter(apt => 
        new Date(apt.appointment_date).toDateString() === today
    );
    
    const pendingAppointments = appointments.filter(apt => 
        apt.status === 'pending'
    );
    
    const todayCount = document.getElementById('todayCount');
    const pendingCount = document.getElementById('pendingCount');
    const totalCount = document.getElementById('totalCount');
    
    if (todayCount) todayCount.textContent = todayAppointments.length;
    if (pendingCount) pendingCount.textContent = pendingAppointments.length;
    if (totalCount) totalCount.textContent = appointments.length;
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