// Global variables
let currentBusinessId = null;
let currentUserId = null;
let businessServices = [];

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    // Business Registration Page
    if (document.getElementById('businessForm')) {
        initBusinessRegistration();
    }
    
    // Customer Booking Page
    if (document.getElementById('userForm')) {
        initCustomerBooking();
    }
    
    // Business Dashboard
    if (document.getElementById('dashboardTitle')) {
        initBusinessDashboard();
    }
});

// Business Registration Functions
function initBusinessRegistration() {
    const businessForm = document.getElementById('businessForm');
    const addServiceBtn = document.getElementById('addService');
    const servicesContainer = document.querySelector('.services-container');
    
    // Add service field
    addServiceBtn.addEventListener('click', function() {
        const serviceInput = document.createElement('div');
        serviceInput.className = 'service-input';
        serviceInput.innerHTML = `
            <input type="text" placeholder="Service name" class="service-name" required>
            <input type="number" placeholder="Price ($)" class="service-price" min="0" step="0.01" required>
            <input type="number" placeholder="Duration (minutes)" class="service-duration" min="1" required>
            <button type="button" class="remove-service">Remove</button>
        `;
        servicesContainer.appendChild(serviceInput);
        
        // Add remove functionality
        serviceInput.querySelector('.remove-service').addEventListener('click', function() {
            servicesContainer.removeChild(serviceInput);
        });
    });
    
    // Form submission
    
    businessForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Show loading state
        const submitBtn = businessForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Registering...';
        submitBtn.disabled = true;
        
        // Collect services
        const services = [];
        const serviceInputs = document.querySelectorAll('.service-input');
        
        serviceInputs.forEach(input => {
            const name = input.querySelector('.service-name').value;
            const price = parseFloat(input.querySelector('.service-price').value);
            const duration = parseInt(input.querySelector('.service-duration').value);
            
            if (name && !isNaN(price) && !isNaN(duration)) {
                services.push({ name, price, duration });
            }
        });
        
        if (services.length === 0) {
            alert('Please add at least one service');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            return;
        }
        
        // Prepare business data
        const businessData = {
            name: document.getElementById('businessName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            services: services
        };
        
        try {
            console.log('Sending request to /api/business');
            const response = await fetch('/api/business', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(businessData)
            });
            
            console.log('Response status:', response.status);
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text.substring(0, 200));
                throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
            }
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            
            // Show success message and QR code
            document.getElementById('businessForm').closest('.form-container').classList.add('hidden');
            document.getElementById('successMessage').classList.remove('hidden');
            
            // Generate QR code
            const qrResponse = await fetch('/api/qrcode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ businessId: result.business.id })
            });
            
            if (!qrResponse.ok) {
                throw new Error('Failed to generate QR code');
            }
            
            const qrResult = await qrResponse.json();
            document.getElementById('qrCodeContainer').innerHTML = `<img src="${qrResult.qrCode}" alt="QR Code">`;
            document.getElementById('businessId').textContent = result.business.id;
            
        } catch (error) {
            console.error('Registration error:', error);
            alert('Error registering business: ' + error.message);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

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
    userForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const userData = {
            businessId: currentBusinessId,
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            phone: document.getElementById('userPhone').value
        };
        
        try {
            // In a real app, we would create or get the user here
            // For simplicity, we'll just store the user data
            currentUserId = userData.email; // Using email as a simple identifier
            
            // Hide user form and show booking form
            document.getElementById('userInfoForm').classList.add('hidden');
            document.getElementById('bookingForm').classList.remove('hidden');
            
            // Load services for this business
            loadServices();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
    
    // Appointment form submission
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
                // Show confirmation
                document.getElementById('bookingForm').classList.add('hidden');
                document.getElementById('confirmationMessage').classList.remove('hidden');
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            alert('Error booking appointment: ' + error.message);
        }
    });
    
    // Book another appointment
    bookAnotherBtn.addEventListener('click', function() {
        document.getElementById('confirmationMessage').classList.add('hidden');
        document.getElementById('bookingForm').classList.remove('hidden');
        document.getElementById('appointmentForm').reset();
    });
}

function loadBusinessInfo() {
    // In a real implementation, we would fetch business details from the API
    // For now, we'll just set a placeholder
    document.getElementById('businessTitle').textContent = "Salon Booking";
}

function loadServices() {
    // In a real implementation, we would fetch services from the business API
    // For now, we'll use some sample services
    const services = [
        { name: "Haircut", price: 30, duration: 30 },
        { name: "Hair Color", price: 80, duration: 120 },
        { name: "Manicure", price: 25, duration: 45 },
        { name: "Pedicure", price: 35, duration: 60 }
    ];
    
    const serviceSelect = document.getElementById('service');
    serviceSelect.innerHTML = '<option value="">Choose a service</option>';
    
    services.forEach(service => {
        const option = document.createElement('option');
        option.value = service.name;
        option.textContent = `${service.name} - $${service.price} (${service.duration} min)`;
        serviceSelect.appendChild(option);
    });
    
    businessServices = services;
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
    refreshBtn.addEventListener('click', function() {
        loadAppointments();
    });
    
    // QR code button
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
    
    // Close modal
    closeModal.addEventListener('click', function() {
        modal.classList.add('hidden');
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
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
    
    document.getElementById('todayCount').textContent = todayAppointments.length;
    document.getElementById('pendingCount').textContent = pendingAppointments.length;
    document.getElementById('totalCount').textContent = appointments.length;
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
            loadAppointments(); // Refresh the list
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error updating appointment: ' + error.message);
    }
}