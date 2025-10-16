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
// Function to display booking form after login/registration
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
            image_url: document.getElementById('stylistImageUrl').value,
            is_active: document.getElementById('stylistActive').checked
        };

        console.log('Submitting stylist data:', stylistData);

        const editingStylistId = document.getElementById('editingStylistId')?.value;
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
            console.log('Stylist saved successfully:', result);
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
    console.log('Loading stylists for business:', currentBusinessId);
    
    const stylistsList = document.getElementById('stylistsList');
    if (!stylistsList) {
        console.error('Stylists list container not found!');
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
            const stylistItem = document.createElement('div');
            stylistItem.className = 'stylist-item';
            stylistItem.innerHTML = `
                <div class="stylist-info">
                    ${stylist.image_url ? `
                        <div class="stylist-image">
                            <img src="${stylist.image_url}" alt="${stylist.name}" onerror="this.style.display='none'">
                        </div>
                    ` : ''}
                    <div class="stylist-details">
                        <h3>${stylist.name} ${!stylist.is_active ? '<span class="inactive-badge">Inactive</span>' : ''}</h3>
                        ${stylist.specialization ? `<p class="stylist-specialization">${stylist.specialization}</p>` : ''}
                        ${stylist.email ? `<p class="stylist-contact">${stylist.email}</p>` : ''}
                        ${stylist.phone ? `<p class="stylist-contact">${stylist.phone}</p>` : ''}
                        ${stylist.bio ? `<p class="stylist-bio">${stylist.bio}</p>` : ''}
                    </div>
                </div>
                <div class="stylist-actions">
                    <button class="stylist-action-btn stylist-edit" onclick="editStylist('${stylist.id}')">
                        Edit
                    </button>
                    <button class="stylist-action-btn stylist-delete" onclick="deleteStylist('${stylist.id}')">
                        Delete
                    </button>
                </div>
            `;
            stylistsList.appendChild(stylistItem);
        });

    } catch (error) {
        console.error('Error loading stylists:', error);
        stylistsList.innerHTML = '<div class="error">Error loading stylists. Please try again.</div>';
    }
}

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
        const stylistItem = document.querySelector(`[onclick="editStylist('${stylistId}')"]`)?.closest('.stylist-item');
        if (stylistItem) {
            stylistItem.classList.add('loading');
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
// APPOINTMENT MANAGEMENT FUNCTIONS
// Initialize appointment filters
function initAppointmentFilters() {
    const statusFilter = document.getElementById('statusFilter');
    const dateRange = document.getElementById('dateRange');
    const exportBtn = document.getElementById('exportBtn');
    
    // Status filter change
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentPage = 1; // Reset to first page when filter changes
            loadAppointments();
        });
    }
    
    // Date range filter change
    if (dateRange) {
        dateRange.addEventListener('change', function() {
            currentPage = 1;
            loadAppointments();
        });
    }
    
    // Export button
    if (exportBtn) {
        exportBtn.addEventListener('click', exportAppointments);
    }
}
// Confirm appointment function
async function confirmAppointment(appointmentId) {
    if (!confirm('Are you sure you want to confirm this appointment?')) {
        return;
    }

    try {
        const response = await fetch('/api/appointments', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: appointmentId,
                status: 'confirmed'
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Send confirmation notification to customer
            await sendAppointmentNotification(appointmentId, 'confirmed');
            
            showNotification('Appointment confirmed successfully!', 'success');
            await loadAppointments(); // Reload the appointments list
            
        } else {
            throw new Error(result.error || 'Failed to confirm appointment');
        }

    } catch (error) {
        console.error('Error confirming appointment:', error);
        showNotification('Error confirming appointment: ' + error.message, 'error');
    }
}

// Cancel appointment function
async function cancelAppointment(appointmentId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
        return;
    }

    try {
        const response = await fetch('/api/appointments', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: appointmentId,
                status: 'cancelled'
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Send cancellation notification to customer
            await sendAppointmentNotification(appointmentId, 'cancelled');
            
            showNotification('Appointment cancelled successfully!', 'success');
            await loadAppointments(); // Reload the appointments list
            
        } else {
            throw new Error(result.error || 'Failed to cancel appointment');
        }

    } catch (error) {
        console.error('Error cancelling appointment:', error);
        showNotification('Error cancelling appointment: ' + error.message, 'error');
    }
}
// Send appointment notification (email/SMS)
async function sendAppointmentNotification(appointmentId, action) {
    try {
        const response = await fetch('/api/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                appointmentId: appointmentId,
                action: action,
                businessId: currentBusinessId
            })
        });

        if (response.ok) {
            console.log(`Notification sent for ${action} appointment`);
        } else {
            console.warn('Failed to send notification, but appointment status was updated');
        }
    } catch (error) {
        console.warn('Notification service unavailable, but appointment status was updated');
    }
}
// Export appointments function
async function exportAppointments() {
    try {
        // Get current filter values
        const dateRange = document.getElementById('dateRange')?.value || 'today';
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        const stylistFilter = document.getElementById('stylistFilter')?.value || 'all';
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        
        let url = `/api/appointments/export?businessId=${currentBusinessId}`;
        
        // Add filters to URL
        const params = new URLSearchParams();
        if (dateRange && dateRange !== 'custom') params.append('dateRange', dateRange);
        if (startDate && endDate && dateRange === 'custom') {
            params.append('startDate', startDate);
            params.append('endDate', endDate);
        }
        if (stylistFilter !== 'all') params.append('stylist', stylistFilter);
        if (statusFilter !== 'all') params.append('status', statusFilter);
        
        if (params.toString()) {
            url += '&' + params.toString();
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to export appointments');
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        
        showNotification('Appointments exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting appointments:', error);
        showNotification('Error exporting appointments: ' + error.message, 'error');
    }
}
// Display appointments in the table
function displayAppointments(appointments) {
    const tbody = document.getElementById('appointmentsTbody');
    if (!tbody) {
        console.error('Appointments table body not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (appointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No appointments found</td></tr>';
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
        
        // Use the transformed data structure
        const customerData = appointment.customers || {};
        const customerName = customerData.name || appointment.customer_name || 'N/A';
        const customerEmail = customerData.email || 'N/A';
        const customerPhone = customerData.phone || 'N/A';
        const avatarLetter = customerName.charAt(0).toUpperCase();
        
        const serviceData = appointment.services || {};
        const serviceName = serviceData.name || appointment.service_name || appointment.service || 'N/A';
        
        const stylistData = appointment.stylists || {};
        const stylistName = stylistData.name || appointment.stylist_name || 'Not assigned';
        
        // Determine status badge class
        const statusClass = `status-${appointment.status}`;
        
        row.innerHTML = `
            <td>
                <div class="customer-cell">
                    <div class="customer-avatar">${avatarLetter}</div>
                    <div>
                        <div>${customerName}</div>
                        <small style="color: var(--gray);">${customerEmail}</small>
                    </div>
                </div>
            </td>
            <td>${serviceName}</td>
            <td>${stylistName}</td>
            <td>${formattedDate}</td>
            <td>${customerPhone}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${appointment.status ? appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1) : 'Pending'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    ${appointment.status === 'pending' ? 
                        `<button class="action-btn btn-confirm" onclick="confirmAppointment('${appointment.id}')">
                            <i class="fas fa-check"></i> Confirm
                        </button>` : ''}
                    ${appointment.status === 'confirmed' ? 
                        `<button class="action-btn btn-complete" onclick="completeAppointment('${appointment.id}')">
                            <i class="fas fa-check-double"></i> Complete
                        </button>` : ''}
                    ${appointment.status !== 'cancelled' && appointment.status !== 'completed' ? 
                        `<button class="action-btn btn-cancel" onclick="cancelAppointment('${appointment.id}')">
                            <i class="fas fa-times"></i> Cancel
                        </button>` : ''}
                    ${appointment.status === 'cancelled' || appointment.status === 'completed' ? 
                        `<button class="action-btn btn-delete" onclick="deleteAppointment('${appointment.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}
// Complete appointment function
async function completeAppointment(appointmentId) {
    if (!confirm('Mark this appointment as completed?')) {
        return;
    }

    try {
        const response = await fetch('/api/appointments', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: appointmentId,
                status: 'completed'
            })
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Appointment marked as completed!', 'success');
            await loadAppointments();
        } else {
            throw new Error(result.error || 'Failed to complete appointment');
        }

    } catch (error) {
        console.error('Error completing appointment:', error);
        showNotification('Error completing appointment: ' + error.message, 'error');
    }
}
// Delete appointment function
async function deleteAppointment(appointmentId) {
    if (!confirm('Are you sure you want to delete this appointment? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/appointments?id=${appointmentId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Appointment deleted successfully!', 'success');
            await loadAppointments();
        } else {
            throw new Error(result.error || 'Failed to delete appointment');
        }

    } catch (error) {
        console.error('Error deleting appointment:', error);
        showNotification('Error deleting appointment: ' + error.message, 'error');
    }
}
// Load appointments with filters and pagination
async function loadAppointments() {
    try {
        console.log('Loading appointments for business:', currentBusinessId);
        
        if (!currentBusinessId) {
            console.error('No business ID available');
            return;
        }

        // Get filter values with null checks
        const dateRange = document.getElementById('dateRange')?.value || 'today';
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        const stylistFilter = document.getElementById('stylistFilter')?.value || 'all';
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        
        let url = `/api/appointments?businessId=${currentBusinessId}&page=${currentPage}&limit=${appointmentsPerPage}`;
        
        // Add filters to URL
        const params = new URLSearchParams();
        if (dateRange && dateRange !== 'custom') params.append('dateRange', dateRange);
        if (startDate && endDate && dateRange === 'custom') {
            params.append('startDate', startDate);
            params.append('endDate', endDate);
        }
        if (stylistFilter !== 'all') params.append('stylist', stylistFilter);
        if (statusFilter !== 'all') params.append('status', statusFilter);
        
        if (params.toString()) {
            url += '&' + params.toString();
        }
        
        console.log('Fetching appointments from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.appointments) {
            throw new Error('No appointments data in response');
        }

        displayAppointments(result.appointments);
        updateStats(result.appointments);
        
        // Update pagination if available
        if (result.totalCount !== undefined) {
            updatePaginationControls(result.totalCount);
        }
        
    } catch (error) {
        console.error('Error loading appointments:', error);
        const tbody = document.getElementById('appointmentsTbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--danger);">Error loading appointments: ${error.message}</td></tr>`;
        }
    }
}
function updateStats(appointments) {
    const today = new Date().toDateString();
    const todayAppointments = appointments.filter(apt => 
        new Date(apt.appointment_date).toDateString() === today
    );
    
    const pendingAppointments = appointments.filter(apt => 
        apt.status === 'pending'
    );
    
    const confirmedAppointments = appointments.filter(apt => 
        apt.status === 'confirmed'
    );
    
    // Update dashboard stats
    const todayCount = document.getElementById('todaysAppointmentsCount');
    const pendingCount = document.getElementById('pendingAppointmentsCount');
    const appointmentBadge = document.getElementById('appointmentBadge');
    
    if (todayCount) todayCount.textContent = todayAppointments.length;
    if (pendingCount) pendingCount.textContent = pendingAppointments.length;
    if (appointmentBadge) appointmentBadge.textContent = pendingAppointments.length;
    
    // Update summary cards if they exist
    const pendingSummary = document.getElementById('pendingCount');
    const confirmedSummary = document.getElementById('confirmedCount');
    const totalSummary = document.getElementById('totalCount');
    
    if (pendingSummary) pendingSummary.textContent = pendingAppointments.length;
    if (confirmedSummary) confirmedSummary.textContent = confirmedAppointments.length;
    if (totalSummary) totalSummary.textContent = appointments.length;
}
// Initialize pagination
function initPagination() {
    console.log('Initializing pagination...');
    updatePaginationEventListeners();
}
// Update pagination event listeners
function updatePaginationEventListeners() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (!prevBtn || !nextBtn) return;

    // Remove existing event listeners by cloning
    const newPrevBtn = prevBtn.cloneNode(true);
    const newNextBtn = nextBtn.cloneNode(true);
    
    if (prevBtn.parentNode) {
        prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    }
    if (nextBtn.parentNode) {
        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    }

    // Add new event listeners to the new buttons
    document.getElementById('prevPage')?.addEventListener('click', function() {
        if (!this.disabled) {
            changePage(-1);
        }
    });

    document.getElementById('nextPage')?.addEventListener('click', function() {
        if (!this.disabled) {
            changePage(1);
        }
    });
}
// Update pagination controls
function updatePaginationControls(totalCount) {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    if (!prevBtn || !nextBtn || !pageInfo) return;

    const totalPages = Math.ceil(totalCount / appointmentsPerPage) || 1;

    // Update previous button
    prevBtn.disabled = currentPage <= 1;
    prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
    prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';

    // Update next button
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';

    // Update page info
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}
// Change page function
function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage < 1) return;
    
    currentPage = newPage;
    console.log(`Changing to page ${currentPage}`);
    loadAppointments();
}
// Format appointment date
function formatAppointmentDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function updateAppointmentStatus(appointmentId, status) {
    try {
        const response = await fetch('/api/appointments', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: appointmentId,
                status: status
            })
        });

        const result = await response.json();

        if (response.ok) {
            showNotification(`Appointment ${status} successfully!`, 'success');
            await loadAppointments(); // Reload the appointments list
            
            // Add notification for status change
            addNotification(`Appointment status changed to ${status}`, 'info');
            
        } else {
            throw new Error(result.error || 'Failed to update appointment');
        }

    } catch (error) {
        console.error('Error updating appointment:', error);
        showNotification('Error updating appointment: ' + error.message, 'error');
    }
}

async function deleteAppointment(appointmentId) {
    if (!confirm('Are you sure you want to delete this appointment? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/appointments?id=${appointmentId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Appointment deleted successfully!', 'success');
            await loadAppointments(); // Reload the appointments list
        } else {
            throw new Error(result.error || 'Failed to delete appointment');
        }

    } catch (error) {
        console.error('Error deleting appointment:', error);
        showNotification('Error deleting appointment: ' + error.message, 'error');
    }
}

// NOTIFICATION FUNCTIONS - FIXED VERSION
function initNotificationPolling() {
    console.log('Initializing notification polling...');
    
    // Load existing notifications
    loadNotifications();
    
    // Set up polling for new notifications every 30 seconds
    setInterval(() => {
        loadNotifications();
    }, 30000);
    
    // Set up notification button
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    
    if (notificationBtn && notificationDropdown) {
        notificationBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationDropdown.classList.toggle('hidden');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function() {
            notificationDropdown.classList.add('hidden');
        });
    }
}

function loadNotifications() {
    const notificationList = document.getElementById('notificationList');
    const notificationCount = document.getElementById('notificationCount');
    
    if (!notificationList) return;
    
    // Get notifications from localStorage
    const notifications = JSON.parse(localStorage.getItem('businessNotifications') || '[]');
    
    // Update notification count
    if (notificationCount) {
        const unreadCount = notifications.filter(n => !n.read).length;
        notificationCount.textContent = unreadCount;
        notificationCount.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
    
    // Update notification list
    if (notifications.length === 0) {
        notificationList.innerHTML = '<div class="no-notifications">No notifications</div>';
        return;
    }
    
    notificationList.innerHTML = '';
    notifications.slice(0, 10).forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
        notificationItem.innerHTML = `
            <div class="notification-content">
                <p class="notification-message">${notification.message}</p>
                <small class="notification-time">${formatNotificationTime(notification.timestamp)}</small>
            </div>
            ${!notification.read ? `
                <button class="mark-read-btn" onclick="markNotificationAsRead('${notification.id}')">
                    Mark as read
                </button>
            ` : ''}
        `;
        notificationList.appendChild(notificationItem);
    });
}

function addNotification(message, type = 'info') {
    const notification = {
        id: generateId(),
        message: message,
        type: type,
        read: false,
        timestamp: new Date().toISOString()
    };
    
    const notifications = JSON.parse(localStorage.getItem('businessNotifications') || '[]');
    notifications.unshift(notification);
    
    // Keep only the last 50 notifications
    if (notifications.length > 50) {
        notifications.splice(50);
    }
    
    localStorage.setItem('businessNotifications', JSON.stringify(notifications));
    
    // Update UI
    loadNotifications();
    
    // Show toast notification
    showNotification(message, type);
}

function markNotificationAsRead(notificationId) {
    const notifications = JSON.parse(localStorage.getItem('businessNotifications') || '[]');
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification) {
        notification.read = true;
        localStorage.setItem('businessNotifications', JSON.stringify(notifications));
        loadNotifications();
    }
}

function formatNotificationTime(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return time.toLocaleDateString();
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function showNotification(message, type = 'info') {
    // Remove any existing notification
    const existingNotification = document.querySelector('.notification-toast');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Appointment booking function
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
// Function to update salon name in sidebar
function updateSalonName() {
    const salonNameElement = document.getElementById('sidebarSalonName');
    if (salonNameElement && currentBusinessData) {
        salonNameElement.textContent = currentBusinessData.name || 'Luxe Beauty Lounge';
    }
}

// Function to initialize menu tab navigation
function initMenuTabNavigation() {
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    console.log('Found menu items:', menuItems.length);
    
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            console.log('Menu tab clicked:', tab);
            
            // Handle QR code tab separately
            if (tab === 'qrcode') {
                console.log('Opening QR code modal');
                showQRCodeModal();
                return;
            }
            
            // Remove active class from all menu items
            menuItems.forEach(menuItem => menuItem.classList.remove('active'));
            // Add active class to clicked menu item
            this.classList.add('active');
            
            // Hide all dashboard sections first
            hideAllDashboardSections();
            
            // Show the selected section
            showDashboardSection(tab);
            
            // Update dashboard title
            updateDashboardTitle(tab);
            
            // Load data for the section if needed
            loadSectionData(tab);
        });
    });
}
// Function to hide all dashboard sections
function hideAllDashboardSections() {
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
}
// Function to show specific dashboard section
function showDashboardSection(tab) {
    console.log('Showing section for tab:', tab);
    
    let sectionId = '';
    
    switch(tab) {
        case 'dashboard':
            sectionId = 'dashboardSection';
            break;
        case 'appointments':
            sectionId = 'appointmentsSection';
            break;
        case 'services':
            sectionId = 'servicesSection';
            break;
        case 'stylists':
            sectionId = 'stylistsSection';
            break;
        default:
            sectionId = 'dashboardSection';
    }
    
    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) {
        console.log('Found section to show:', sectionId);
        sectionToShow.classList.add('active');
    } else {
        console.error('Section not found:', sectionId);
    }
}
// Function to load data for specific section
function loadSectionData(tab) {
    console.log('Loading data for section:', tab);
    
    switch(tab) {
        case 'dashboard':
            // Load dashboard stats and data
            loadDashboardData();
            break;
        case 'appointments':
            loadAppointments();
            break;
        case 'services':
            loadServices();
            break;
        case 'stylists':
            loadStylists();
            break;
    }
}
// Function to load dashboard data
async function loadDashboardData() {
    try {
        // Load today's appointments count
        const todayResponse = await fetch(`/api/appointments?businessId=${currentBusinessId}&dateRange=today`);
        if (todayResponse.ok) {
            const todayData = await todayResponse.json();
            const todayCount = document.getElementById('todaysAppointmentsCount');
            if (todayCount) {
                todayCount.textContent = todayData.appointments ? todayData.appointments.length : 0;
            }
        }
        
        // Load pending appointments count
        const pendingResponse = await fetch(`/api/appointments?businessId=${currentBusinessId}&status=pending`);
        if (pendingResponse.ok) {
            const pendingData = await pendingResponse.json();
            const pendingCount = document.getElementById('pendingAppointmentsCount');
            const appointmentBadge = document.getElementById('appointmentBadge');
            
            const pendingAppointments = pendingData.appointments ? pendingData.appointments.length : 0;
            
            if (pendingCount) {
                pendingCount.textContent = pendingAppointments;
            }
            if (appointmentBadge) {
                appointmentBadge.textContent = pendingAppointments;
                appointmentBadge.style.display = pendingAppointments > 0 ? 'flex' : 'none';
            }
        }
        
        // Load daily schedule
        loadDailySchedule();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}
// Function to load daily schedule
async function loadDailySchedule() {
    try {
        const scheduleSlots = document.getElementById('scheduleSlots');
        if (!scheduleSlots) return;

        // Get today's appointments for the schedule
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/appointments?businessId=${currentBusinessId}&dateRange=today`);
        
        if (response.ok) {
            const result = await response.json();
            const appointments = result.appointments || [];
            
            // Generate time slots for the day (9 AM to 6 PM)
            const timeSlots = generateTimeSlots();
            
            scheduleSlots.innerHTML = '';
            
            timeSlots.forEach(slot => {
                const slotElement = document.createElement('div');
                slotElement.className = 'time-slot available';
                
                // Check if this time slot is booked
                const isBooked = appointments.some(apt => {
                    const aptTime = new Date(apt.appointment_date);
                    const aptHour = aptTime.getHours();
                    const aptMinute = aptTime.getMinutes();
                    return aptHour === slot.hour && aptMinute === slot.minute;
                });
                
                if (isBooked) {
                    slotElement.classList.add('booked');
                    slotElement.classList.remove('available');
                }
                
                slotElement.innerHTML = `
                    <div class="time">${slot.displayTime}</div>
                    <div class="slot-info">${isBooked ? 'Booked' : 'Available'}</div>
                `;
                
                scheduleSlots.appendChild(slotElement);
            });
        }
    } catch (error) {
        console.error('Error loading daily schedule:', error);
    }
}
// Helper function to generate time slots
function generateTimeSlots() {
    const slots = [];
    const startHour = 9; // 9 AM
    const endHour = 18; // 6 PM
    
    for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) { // 30-minute intervals
            const time = new Date();
            time.setHours(hour, minute, 0, 0);
            
            slots.push({
                hour: hour,
                minute: minute,
                displayTime: time.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                })
            });
        }
    }
    
    return slots;
}

// Function to update dashboard title based on active tab
function updateDashboardTitle(tab) {
    const titleElement = document.getElementById('dashboardTitle');
    const subtitleElement = document.querySelector('.page-title p');
    
    if (!titleElement) return;

    const titles = {
        'dashboard': 'Salon Dashboard',
        'appointments': 'Appointments Management',
        'services': 'Services Management',
        'stylists': 'Stylists Management'
    };

    const subtitles = {
        'dashboard': 'Manage your salon appointments and stylists',
        'appointments': 'View and manage all appointments',
        'services': 'Manage your salon services and pricing',
        'stylists': 'Manage your stylists and their availability'
    };

    titleElement.textContent = titles[tab] || 'Salon Dashboard';
    if (subtitleElement) {
        subtitleElement.textContent = subtitles[tab] || 'Manage your salon appointments and stylists';
    }
}

// QR Code Modal Functions
function initQRCodeModal() {
    const qrModal = document.getElementById('qrModal');
    const closeModalBtn = qrModal?.querySelector('.close-modal');
    const downloadQrBtn = document.getElementById('downloadQrBtn');
    const printQrBtn = document.getElementById('printQrBtn');

    // Close modal when close button is clicked
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            closeQRCodeModal();
        });
    }

    // Close modal when clicking outside
    if (qrModal) {
        qrModal.addEventListener('click', function(e) {
            if (e.target === qrModal) {
                closeQRCodeModal();
            }
        });
    }

    // Download QR code
    if (downloadQrBtn) {
        downloadQrBtn.addEventListener('click', function() {
            downloadQRCode();
        });
    }

    // Print QR code
    if (printQrBtn) {
        printQrBtn.addEventListener('click', function() {
            printQRCode();
        });
    }
}

function showQRCodeModal() {
    const modal = document.getElementById('qrModal');
    if (!modal) return;

    // Generate or retrieve QR code
    generateOrRetrieveQRCode();
    
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function closeQRCodeModal() {
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

async function generateOrRetrieveQRCode() {
    const qrCodeContainer = document.getElementById('modalQrCode');
    if (!qrCodeContainer) return;

    try {
        // Check if we already have a QR code in localStorage
        const storedQRCode = localStorage.getItem(`businessQRCode_${currentBusinessId}`);
        
        if (storedQRCode) {
            displayQRCode(storedQRCode);
            return;
        }

        // Generate new QR code
        const qrResponse = await fetch('/api/qrcode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ businessId: currentBusinessId })
        });

        if (!qrResponse.ok) {
            throw new Error('Failed to generate QR code');
        }

        const qrResult = await qrResponse.json();
        
        if (qrResult.qrCode) {
            // Store QR code in localStorage for future use
            localStorage.setItem(`businessQRCode_${currentBusinessId}`, qrResult.qrCode);
            displayQRCode(qrResult.qrCode);
        } else {
            // Fallback: Create QR code using a service or generate URL
            createFallbackQRCode();
        }

    } catch (error) {
        console.error('Error generating QR code:', error);
        createFallbackQRCode();
    }
}

function displayQRCode(qrCodeData) {
    const qrCodeContainer = document.getElementById('modalQrCode');
    if (!qrCodeContainer) return;

    qrCodeContainer.innerHTML = `
        <div style="text-align: center;">
            <img src="${qrCodeData}" alt="Business QR Code" style="max-width: 300px; height: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
            <p style="margin-top: 15px; color: var(--gray); font-size: 14px;">
                Scan this QR code to book appointments
            </p>
        </div>
    `;
}

function createFallbackQRCode() {
    const qrCodeContainer = document.getElementById('modalQrCode');
    if (!qrCodeContainer) return;

    const bookingUrl = `${window.location.protocol}//${window.location.host}/customer.html?business=${currentBusinessId}`;
    
    qrCodeContainer.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                <i class="fas fa-qrcode" style="font-size: 48px; color: var(--primary); margin-bottom: 15px;"></i>
                <p style="color: var(--danger); margin-bottom: 15px;">
                    QR code generation unavailable. Use the URL below:
                </p>
                <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid var(--border-color);">
                    <strong style="word-break: break-all; font-size: 14px;">${bookingUrl}</strong>
                </div>
            </div>
            <p style="color: var(--gray); font-size: 12px;">
                You can use any QR code generator with this URL to create your booking QR code.
            </p>
        </div>
    `;
}

function downloadQRCode() {
    const qrImage = document.querySelector('#modalQrCode img');
    if (qrImage && qrImage.src) {
        const link = document.createElement('a');
        link.download = `salon-booking-qr-${currentBusinessId}.png`;
        link.href = qrImage.src;
        link.click();
    } else {
        // Fallback: Create a downloadable version of the URL
        const bookingUrl = `${window.location.protocol}//${window.location.host}/customer.html?business=${currentBusinessId}`;
        const blob = new Blob([bookingUrl], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `salon-booking-url-${currentBusinessId}.txt`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        
        showNotification('QR code image not available. Downloaded booking URL instead.', 'info');
    }
}

function printQRCode() {
    const qrContent = document.getElementById('modalQrCode').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Salon Booking QR Code</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    padding: 40px;
                    background: white;
                }
                .qr-container { 
                    margin: 20px auto; 
                    max-width: 300px;
                }
                .business-info {
                    margin-bottom: 20px;
                    color: #333;
                }
                .instructions {
                    margin-top: 20px;
                    color: #666;
                    font-size: 14px;
                }
                @media print {
                    body { margin: 0; padding: 20px; }
                }
            </style>
        </head>
        <body>
            <div class="business-info">
                <h2>${currentBusinessData?.name || 'Salon'} Booking</h2>
                <p>Scan to book an appointment</p>
            </div>
            <div class="qr-container">${qrContent}</div>
            <div class="instructions">
                <p>Scan this QR code with your phone's camera to book an appointment</p>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}
// BUSINESS DASHBOARD INITIALIZATION - FIXED VERSION
function initBusinessDashboard() {
    console.log('Initializing business dashboard...');
    
    // Get business ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentBusinessId = urlParams.get('id');
    
    console.log('Business ID from URL:', currentBusinessId);
    
    // Check if business ID exists and is valid
    if (!currentBusinessId) {
        console.error('No business ID found in URL');
        showNotification('Invalid business URL. Please use the correct dashboard link.', 'error');
        return;
    }
    
    // Check if user is logged in as business
    const businessUser = JSON.parse(localStorage.getItem('businessUser') || 'null');
    const userType = localStorage.getItem('userType');
    
    console.log('Business user from storage:', businessUser);
    console.log('User type from storage:', userType);
    
    if (!businessUser || userType !== 'business') {
        console.log('No business user found, redirecting to login...');
        window.location.href = 'customer.html?type=business';
        return;
    }
    
    // Verify the business user matches the URL
    if (businessUser.id !== currentBusinessId) {
        console.error('Business user ID does not match URL ID');
        showNotification('Access denied. Please login with the correct business account.', 'error');
        return;
    }
    
    currentUserId = businessUser.id;
    currentUserType = 'business';
    currentBusinessData = businessUser;
    
    console.log('Business dashboard initialized for:', businessUser.name);
    
    // Update business info in dashboard
    updateBusinessInfo(businessUser);
    updateSalonName();
    
    // Initialize dashboard sections
    initMenuTabNavigation();
    initServiceManagement();
    initStylistManagement();
    initQRCodeModal();
    initAppointmentFilters(); 
    initPagination(); 
    
    // Set initial state - show dashboard by default
    hideAllDashboardSections();
    showDashboardSection('dashboard');
    
    // Set active menu item
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    menuItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-tab') === 'dashboard') {
            item.classList.add('active');
        }
    });
    
    updateDashboardTitle('dashboard');
    
    // Load initial data
    try {
        loadDashboardData();
        // Pre-load other data in background for faster switching
        setTimeout(() => {
            loadAppointments();
            loadServices();
            loadStylists();
        }, 1000);
    } catch (error) {
        console.error('Error loading initial data:', error);
        showNotification('Error loading dashboard data', 'error');
    }
    
    initNotificationPolling();
    
    // Set up logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('businessUser');
            localStorage.removeItem('userType');
            window.location.href = 'customer.html';
        });
    }
}
// Debug function to check section visibility
function debugSectionVisibility() {
    console.log('=== SECTION VISIBILITY DEBUG ===');
    const sections = [
        { id: 'dashboard', name: 'Dashboard' },
        { id: 'appointmentsSection', name: 'Appointments' },
        { id: 'servicesSection', name: 'Services' },
        { id: 'stylistsSection', name: 'Stylists' }
    ];
    
    sections.forEach(section => {
        const element = document.getElementById(section.id);
        if (element) {
            console.log(`${section.name}:`, {
                exists: true,
                display: element.style.display,
                computedDisplay: window.getComputedStyle(element).display,
                hidden: element.classList.contains('hidden')
            });
        } else {
            console.log(`${section.name}: ELEMENT NOT FOUND`);
        }
    });
    console.log('=== END DEBUG ===');
}
function updateBusinessInfo(business) {
    const businessNameElement = document.getElementById('businessNameDisplay');
    const businessEmailElement = document.getElementById('businessEmailDisplay');
    const businessPhoneElement = document.getElementById('businessPhoneDisplay');
    const businessAddressElement = document.getElementById('businessAddressDisplay');
    
    if (businessNameElement) businessNameElement.textContent = business.name;
    if (businessEmailElement) businessEmailElement.textContent = business.email;
    if (businessPhoneElement) businessPhoneElement.textContent = business.phone;
    if (businessAddressElement) businessAddressElement.textContent = business.address;
}

// Tab navigation
function initDashboardTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Show target tab content
            tabContents.forEach(content => {
                content.classList.add('hidden');
                if (content.id === targetTab) {
                    content.classList.remove('hidden');
                }
            });
            
            // Load data for the tab if needed
            if (targetTab === 'appointments') {
                loadAppointments();
            } else if (targetTab === 'services') {
                loadServices();
            } else if (targetTab === 'stylists') {
                loadStylists();
            }
        });
    });
}
// Initialize based on current page
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...');
    
    // Check which page we're on and initialize accordingly
    if (window.location.pathname.includes('business.html')) {
        console.log('Initializing business dashboard...');
        initBusinessDashboard();
    } else if (window.location.pathname.includes('customer.html')) {
        console.log('Initializing customer authentication...');
        initCustomerAuthentication();
        handleBusinessLoginRedirect();
    } else {
        console.log('Initializing business registration...');
        initBusinessRegistration();
        initBusinessAuthentication();
    }
});