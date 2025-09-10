const API_BASE_URL = '/api';
let token = localStorage.getItem('token') || null;
let userId = null;

function decodeJWT(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch (e) {
        return null;
    }
}


let currentErrorElement = null;

async function fetchWithAuth(url, options = {}) {
    const headers = { 
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
    try {
        const res = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });
        
        if (!res.ok) {
            let errorMessage;
            
            switch (res.status) {
                case 401:
                    errorMessage = 'Incorrect login or password';
                    break;
                case 404:
                    errorMessage = 'Make sure that an account with this login exists';
                    break;
                case 500:
                    errorMessage = 'Internal server error';
                    break;
                default:
                    try {
                        const errorData = await res.json();
                        errorMessage = errorData.message || `Error ${res.status}`;
                    } catch {
                        errorMessage = `Error ${res.status}`;
                    }
            }
            
            throw new Error(errorMessage);
        }
        
        if (res.status === 204 || res.headers.get('content-length') === '0') {
            return {};
        }
        
        try {
            return await res.json();
        } catch {
            return {};
        }
    } catch (err) {
        showError(err.message);
        throw err;
    }
}

function showError(message) {
    if (currentErrorElement) {
        currentErrorElement.remove();
        currentErrorElement = null;
    }
    
    let displayMessage = message;

    if (message.includes('Failed to') || message.includes('failed to')) {
        const parts = message.split(':');
        if (parts.length > 1) {
            displayMessage = parts[1].trim();
        }
    }
    
    if (message.includes('Failed to fetch')) {
        displayMessage = 'Network error. Please check your connection.';
    } else if (message.includes('Unexpected token')) {
        displayMessage = 'Server error. Please try again later.';
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = displayMessage;
    document.getElementById('content').prepend(errorDiv);
    
    currentErrorElement = errorDiv;
    
    setTimeout(() => {
        if (currentErrorElement === errorDiv) {
            errorDiv.remove();
            currentErrorElement = null;
        }
    }, 5000);
}


function showModal(content) {
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal').style.display = 'flex';
    
    document.getElementById('modal').onclick = function(event) {
        if (event.target === document.getElementById('modal')) {
            closeModal();
        }
    };
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

function renderNavbar() {
    const nav = document.getElementById('navbar');
    const isLoggedIn = !!token;
    nav.innerHTML = `
        ${isLoggedIn ? `
            <button onclick="showProfile()">Profile</button>
            <button onclick="showCourses()">Courses</button>
            <button onclick="logout()">Logout</button>
        ` : `
            <button onclick="showLogin()">Login</button>
            <button onclick="showRegister()">Register</button>
        `}
        <button onclick="showHome()">Home</button>
    `;
}

function showHome() {
    document.getElementById('content').innerHTML = `
        <h1>Welcome to <span>Sleepless School</span>!</h1>
        <div class="card">
            <p>Are you ready to embark on an exciting journey into the endless world of knowledge?</p>
            <p>Great!</p>
            <p>Then go ahead, towards new discoveries!</p>
        </div>
    `;
       renderNavbar();
}

function showLogin() {
    document.getElementById('content').innerHTML = `
        <h1>Login</h1>
        <div class="card">
            <div class="form-group">
                <label for="login-email">Email</label>
                <input id="login-email" type="email" placeholder="Enter your email" required>
            </div>
            <div class="form-group">
                <label for="login-password">Password</label>
                <input id="login-password" type="password" placeholder="Enter your password" required>
            </div>
            <button onclick="login()">Login</button>
            <button onclick="showForgotPassword()">Forgot Password?</button>
        </div>
    `;
    renderNavbar();
}

function showRegister() {
    document.getElementById('content').innerHTML = `
        <h1>Register</h1>
        <div class="card">
            <div class="form-group">
                <label for="reg-email">Email</label>
                <input id="reg-email" type="email" placeholder="Enter your email" required>
            </div>
            <div class="form-group">
                <label for="reg-password">Password</label>
                <input id="reg-password" type="password" placeholder="Enter your password" required>
            </div>
            <div class="form-group">
                <label for="reg-confirm-password">Confirm Password</label>
                <input id="reg-confirm-password" type="password" placeholder="Confirm your password" required>
            </div>
            <button onclick="register()">Register</button>
        </div>
    `;
    renderNavbar();
}

function showForgotPassword() {
    document.getElementById('content').innerHTML = `
        <h1>Forgot Password</h1>
        <div class="card">
            <div class="form-group">
                <label for="forgot-email">Email</label>
                <input id="forgot-email" type="email" placeholder="Enter your email" required>
            </div>
            <button onclick="initiatePasswordReset()"> Send Reset Code</button>
        </div>
    `;
    renderNavbar();
}


function fillFormFields(fields) {
    Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element && value !== undefined && value !== null) {
            element.value = value;
        }
    });
}


let userEnrollments = [];

async function showProfile() {
    if (!token) {
        showLogin();
        return;
    }
    const payload = decodeJWT(token);
    const user = await fetchWithAuth(`/profile?emailAddress=${payload.sub}`);
    const createdCourses = await fetchWithAuth(`/courses?authorId=${user.id}`);

    userEnrollments = await fetchWithAuth(`/enroll/student/${user.id}`);

    const enrollments = await fetchWithAuth(`/enroll/student/${user.id}`);
    const enrolledCourses = await Promise.all(
        enrollments.map(async (enrollment) => 
            await fetchWithAuth(`/courses/${enrollment.enrollmentId.courseId}`)
        )
    );
    document.getElementById('content').innerHTML = `
        <h1>Profile</h1>
        <div class="card">
            <p><strong>Email:</strong> ${user.emailAddress}</p>
            <p><strong>Username:</strong> ${user.username || 'User'}</p>
            <p><strong>Info:</strong> ${user.information || 'No info'}</p>
            <button onclick="showEditProfile(${user.id})">Edit Profile</button>
            <button onclick="showChangeEmail()">Change Email</button>
            <button onclick="showChangePassword()">Change Password</button>
            <button onclick="deleteAccount(${user.id})">Delete Account</button>
        </div>
        <h2>My Courses</h2>
        <div class="course-list">
            ${createdCourses.content?.map(course => `
                <div class="course-item" onclick="showCourse(${course.id})">
                    <h3>${course.title}</h3>
                    <p><strong>ID:</strong> ${course.id}</p>
                    <p><strong>Author ID:</strong> ${course.authorId}</p>
                    <p><strong>Description:</strong> ${course.description || 'No description'}</p>
                    <p><strong>Created:</strong> ${course.creationDate}</p>
                    <p><strong>Last Updated:</strong> ${course.lastUpdateDate}</p>
                </div>
            `).join('') || '<p>No courses created.</p>'}
            <button onclick="showCreateCourse()">Create New Course</button>
            <br>
        </div>
        <h2>Enrolled Courses</h2>
        <div class="course-list">
            ${enrolledCourses.map(course => `
                <div class="course-item" onclick="showCourse(${course.id})">
                    <h3>${course.title}</h3>
                    <p><strong>ID:</strong> ${course.id}</p>
                    <p><strong>Author ID:</strong> ${course.authorId}</p>
                    <p><strong>Description:</strong> ${course.description || ''}</p>
                    <p><strong>Created:</strong> ${course.creationDate}</p>
                    <p><strong>Last Updated:</strong> ${course.lastUpdateDate}</p>
                </div>
            `).join('') || '<p>Not enrolled in any courses.</p>'}
        </div>
    `;
    renderNavbar();
    userId = user.id;
}

function showEditProfile(id) {
    fetchWithAuth(`/profile?emailAddress=${decodeJWT(token).sub}`)
        .then(user => {
            showModal(`
                <h2>Edit Profile</h2>
                <div class="form-group">
                    <label for="edit-username">Username</label>
                    <input id="edit-username" type="text" placeholder="Enter username" value="${user.username || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-info">Information</label>
                    <input id="edit-info" type="text" placeholder="Enter information" value="${user.information || ''}">
                </div>
                <button onclick="updateProfile(${id})">Save</button>
                <button onclick="closeModal()">Cancel</button>
            `);
        })
        .catch(err => showError('Failed to load profile: ' + err.message));
}

function showChangeEmail() {
    showModal(`
        <h2>Change Email</h2>
        <div class="form-group">
            <label for="new-email">New Email</label>
            <input id="new-email" type="email" placeholder="Enter new email" required>
        </div>
        <div class="form-group">
            <label for="email-password">Password</label>
            <input id="email-password" type="password" placeholder="Enter password" required>
        </div>
        <button onclick="changeEmail()">Submit</button>
        <button onclick="closeModal()">Cancel</button>
    `);
}

function showChangePassword() {
    showModal(`
        <h2>Reset Password</h2>
        <div class="form-group">
            <label for="reset-email">Email</label>
            <input id="reset-email" type="email" placeholder="Enter your email" required>
        </div>
        <button onclick="initiatePasswordReset()">Send Reset Code</button>
        <button onclick="closeModal()">Cancel</button>
    `);
}

function showCourses() {
    if (!token) {
        showError('Please login to access courses');
        showLogin();
        return;
    }
    document.getElementById('content').innerHTML = `
        <h1>Search Courses</h1>
        <div class="card">
            <div class="filter-form">
                <div class="form-group">
                    <label for="filter-authorId">Author ID</label>
                    <input id="filter-authorId" type="number" placeholder="Enter author ID">
                </div>
                <div class="form-group">
                    <label for="filter-title">Title</label>
                    <input id="filter-title" type="text" placeholder="Enter title">
                </div>
                <div class="form-group">
                    <label for="filter-description">Description</label>
                    <input id="filter-description" type="text" placeholder="Enter description">
                </div>
                <div class="form-group">
                    <label for="filter-startDate">Start Date</label>
                    <input id="filter-startDate" type="date">
                </div>
                <div class="form-group">
                    <label for="filter-endDate">End Date</label>
                    <input id="filter-endDate" type="date">
                </div>
                <div class="form-group">
                    <button onclick="searchCourses()">Search</button>
                </div>
            </div>
        </div>
        <div class="course-list" id="course-list"></div>
    `;
    renderNavbar();
    searchCourses();
}

function showCreateCourse() {
    showModal(`
        <h2>Create Course</h2>
        <div class="form-group">
            <label for="course-title">Title</label>
            <input id="course-title" type="text" placeholder="Enter course title" required>
        </div>
        <div class="form-group">
            <label for="course-desc">Description</label>
            <textarea id="course-desc" placeholder="Enter course description (resizable)"></textarea>
        </div>
        <button onclick="createCourse()">Save</button>
        <button onclick="closeModal()">Cancel</button>
    `);
}

function showEditCourse(courseId) {
    fetchWithAuth(`/courses/${courseId}`)
        .then(course => {
            showModal(`
                <h2>Edit Course</h2>
                <div class="form-group">
                    <label for="edit-course-title">Title</label>
                    <input id="edit-course-title" type="text" placeholder="Enter course title" value="${course.title || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-course-desc">Description</label>
                    <textarea id="edit-course-desc" placeholder="Enter description">${course.description || ''}</textarea>
                </div>
                <button onclick="updateCourse(${courseId})">Save</button>
                <button onclick="closeModal()">Cancel</button>
            `);
        })
        .catch(err => showError('Failed to load course: ' + err.message));
}

let currentCourseId = null;

async function showLesson(lessonId) {
    try {
        const lesson = await fetchWithAuth(`/lessons/${lessonId}`);
        const course = await fetchWithAuth(`/courses/${lesson.courseId}`);
        const isAuthor = userId === course.authorId;
        document.getElementById('content').innerHTML = `
            <div class="lesson-content-wrapper">
                <h1>${lesson.title}</h1>
                <div class="card">
                    <p>${lesson.description || 'No description'}</p>
                </div>
                <div class="lesson-text-content">${lesson.content ? lesson.content.replace(/\n/g, '<br>') : ''}</div>
            </div>
            <div class="lesson-actions">
                ${isAuthor ? `
                    <button onclick="showEditLesson(${lessonId}, ${lesson.courseId})">Edit Lesson</button>
                    <button onclick="deleteLesson(${lessonId})">Delete Lesson</button>
                ` : ''}
                <button onclick="showCourse(${lesson.courseId})">Back to Course</button>
            </div>
        `;
        renderNavbar();
    } catch (err) {
        showError('Failed to load lesson: ' + err.message);
    }
}

async function showCourse(courseId) {
    try {
        currentCourseId = courseId;
        const course = await fetchWithAuth(`/courses/${courseId}`);
        console.log('Course response:', course);
        const lessons = await fetchWithAuth(`/lessons/course/${courseId}`);
        const payload = decodeJWT(token);
        const isAuthor = payload && userId === course.authorId;
                
        const isEnrolled = userEnrollments.some(e => 
            e.enrollmentId?.courseId === courseId || 
            e.courseId === courseId
        );
                
        document.getElementById('content').innerHTML = `
            <h1>${course.title}</h1>
            <div class="card">
                <p><strong>Author ID:</strong> ${course.authorId}</p>
                <p><strong>Description:</strong> ${course.description || 'No description'}</p>
                <p><strong>Created:</strong> ${course.creationDate}</p>
                <p><strong>Last Updated:</strong> ${course.lastUpdateDate}</p>
                ${isAuthor ? `
                    <button onclick="showEditCourse(${courseId})">Edit Course</button>
                    <button onclick="deleteCourse(${courseId})">Delete Course</button>
                    <button onclick="showCreateLesson(${courseId})">Add Lesson</button>
                ` : (token ? (isEnrolled ? `
                    <button onclick="leaveCourse()">Leave Course</button>
                ` : `
                    <button onclick="enrollCourse()">Enroll</button>
                `) : '')}
            </div>
            <h2>Lessons</h2>
            <div class="lesson-list">
                ${lessons.content?.map(lesson => `
                    <div class="lesson-item" onclick="${(isAuthor || isEnrolled) ? `showLesson(${lesson.id})` : 'alert(\'You need to enroll in this course first\')'}">
                        <h3>${lesson.title}</h3>
                        <p>${lesson.description || 'No description'}</p>
                    </div>
                `).join('') || '<p>No lessons available.</p>'}
            </div>
        `;
        renderNavbar();
    } catch (err) {
        showError('Failed to load course: ' + err.message);
    }
}

function showCreateLesson(courseId) {
    showModal(`
        <h2>Create Lesson</h2>
        <div class="form-group">
            <label for="lesson-title">Title</label>
            <input id="lesson-title" type="text" placeholder="Enter lesson title" required>
        </div>
        <div class="form-group">
            <label for="lesson-seq">Sequence Number</label>
            <input id="lesson-seq" type="number" placeholder="Enter sequence number" required>
        </div>
        <div class="form-group">
            <label for="lesson-desc">Description</label>
            <textarea id="lesson-desc" placeholder="Enter description (resizable)"></textarea>
        </div>
        <div class="form-group">
            <label for="lesson-content">Content</label>
            <textarea id="lesson-content" placeholder="Enter lesson content (resizable)"></textarea>
        </div>
        <button onclick="createLesson(${courseId})">Create</button>
        <button onclick="closeModal()">Cancel</button>
    `);
}


function showEditLesson(lessonId, courseId) {
    fetchWithAuth(`/lessons/${lessonId}`)
        .then(lesson => {
            showModal(`
                <h2>Edit Lesson</h2>
                <div class="form-group">
                    <label for="edit-lesson-title">Title</label>
                    <input id="edit-lesson-title" type="text" value="${lesson.title || ''}" required>
                </div>
                <div class="form-group">
                    <label for="edit-lesson-seq">Sequence Number</label>
                    <input id="edit-lesson-seq" type="number" value="${lesson.sequenceNumber || ''}" required>
                </div>
                <div class="form-group">
                    <label for="edit-lesson-desc">Description</label>
                    <textarea id="edit-lesson-desc">${lesson.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="edit-lesson-content">Content</label>
                    <textarea id="edit-lesson-content">${lesson.content || ''}</textarea>
                </div>
                <button onclick="updateLesson(${lessonId}, ${courseId})">Save</button>
                <button onclick="closeModal()">Cancel</button>
            `);
        })
        .catch(err => showError(err.message));
}

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const data = await fetchWithAuth('/auth/login', {
            method: 'POST',
                body: JSON.stringify({ emailAddress: email, password })
        });
        token = data.token;
        localStorage.setItem('token', token);
        showProfile();
    } catch (err) {
        showError('Login failed: ' + err.message);
    }
}

async function register() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    try {
        await fetchWithAuth('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ emailAddress: email, password, confirmationPassword: confirmPassword })
        });
        showModal(`
            <h2>Confirm Registration</h2>
            <div class="form-group">
                <label for="confirm-code">Confirmation Code</label>
                <input id="confirm-code" type="text" placeholder="Enter confirmation code" required>
            </div>
            <button onclick="confirmRegistration('${email}', '${password}')">Confirm</button>
            <button onclick="closeModal()">Cancel</button>
        `);
    } catch (err) {
        showError('Registration failed: ' + err.message);
    }
}

async function confirmRegistration(email, password) {
    const code = document.getElementById('confirm-code').value;
    try {
        const data = await fetchWithAuth(`/auth/confirm-registration?confirmationCode=${code}`, {
            method: 'POST',
            body: JSON.stringify({ emailAddress: email, password, confirmationPassword: password })
        });
        token = data.token;
        localStorage.setItem('token', token);
        closeModal();
        showProfile();
    } catch (err) {
        showError('Confirmation failed: ' + err.message);
    }
}

async function initiatePasswordReset() {
    const email = document.getElementById('forgot-email').value;
    try {
        await fetchWithAuth(`/auth/forgot-password?emailAddress=${email}`, { method: 'POST' });
        
        closeModal();
        showModal(`
            <h2>Enter Reset Code</h2>
            <div class="form-group">
                <label for="reset-code">Reset Code</label>
                <input id="reset-code" type="text" placeholder="Enter reset code sent to your email" required>
            </div>
            <button onclick="validateResetCode('${email}')">Verify Code</button>
            <button onclick="closeModal()">Cancel</button>
        `);
        
    } catch (err) {
        showError('Failed to send reset code: ' + err.message);
    }
}

async function validateResetCode(email) {
    const code = document.getElementById('reset-code').value;
    try {
        await fetchWithAuth(`/auth/validate-reset-code?emailAddress=${email}&resetCode=${code}`, { 
            method: 'POST' 
        });
        
        closeModal();
        showModal(`
            <h2>Set New Password</h2>
            <div class="form-group">
                <label for="new-password">New Password</label>
                <input id="new-password" type="password" placeholder="Enter new password" required>
            </div>
            <div class="form-group">
                <label for="confirm-password">Confirm Password</label>
                <input id="confirm-password" type="password" placeholder="Confirm new password" required>
            </div>
            <button onclick="resetPassword('${email}', '${code}')">Reset Password</button>
            <button onclick="closeModal()">Cancel</button>
        `);
        
    } catch (err) {
        showError('Failed to validate reset code: ' + err.message);
    }
}

async function resetPassword(email, code) {
    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    try {
        await fetchWithAuth('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ 
                emailAddress: email, 
                password, 
                confirmationPassword: confirmPassword 
            })
        });
        
        closeModal();
        showSuccess('Password reset successfully!');
        showLogin();
        
    } catch (err) {
        showError('Password reset failed: ' + err.message);
    }
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    document.getElementById('content').prepend(successDiv);
    setTimeout(() => successDiv.remove(), 5000);
}

async function changeEmail() {
    const newEmail = document.getElementById('new-email').value;
    const password = document.getElementById('email-password').value;
    const payload = decodeJWT(token);
    try {
        await fetchWithAuth(`/auth/change-email-address?emailAddress=${newEmail}`, {
            method: 'POST',
            body: JSON.stringify({ emailAddress: payload.sub, password })
        });
        showModal(`
            <h2>Confirm Email Change</h2>
            <div class="form-group">
                <label for="confirm-code">Confirmation Code</label>
                <input id="confirm-code" type="text" placeholder="Enter confirmation code" required>
            </div>
            <button onclick="confirmEmailChange('${payload.sub}', '${newEmail}', '${password}')">Confirm</button>
            <button onclick="closeModal()">Cancel</button>
        `);
    } catch (err) {
        showError('Failed to initiate email change: ' + err.message);
    }
}

async function confirmEmailChange(oldEmail, newEmail, password) {
    const code = document.getElementById('confirm-code').value;
    try {
        await fetchWithAuth(`/auth/confirm-email-address?emailAddress=${newEmail}&confirmationCode=${code}`, {
            method: 'POST',
            body: JSON.stringify({ emailAddress: oldEmail, password })
        });
        token = null;
        localStorage.removeItem('token');
        closeModal();
        showLogin();
    } catch (err) {
        showError('Failed to confirm email change: ' + err.message);
    }
}

async function updateProfile(id) {
    const username = document.getElementById('edit-username').value;
    const information = document.getElementById('edit-info').value;
    try {
        await fetchWithAuth(`/profile/edit/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ 
                emailAddress: decodeJWT(token).sub, 
                username, 
                information 
            })
        });
        closeModal();
        showProfile();
    } catch (err) {
        showError('Failed to update profile: ' + err.message);
    }
}

async function deleteAccount(id) {
    if (confirm('Are you sure you want to delete your account?')) {
        try {
            await fetchWithAuth(`/profile/delete/${id}`, { method: 'DELETE' });
            logout();
        } catch (err) {
            showError('Failed to delete account: ' + err.message);
        }
    }
}

async function searchCourses() {
    const authorId = document.getElementById('filter-authorId')?.value || '';
    const title = document.getElementById('filter-title')?.value || '';
    const description = document.getElementById('filter-description')?.value || '';
    const startDate = document.getElementById('filter-startDate')?.value || '';
    const endDate = document.getElementById('filter-endDate')?.value || '';
    const params = new URLSearchParams({ authorId, title, description, startingDate: startDate, endingDate: endDate });
    try {
        const data = await fetchWithAuth(`/courses/search?${params}`);
        document.getElementById('course-list').innerHTML = data.content?.map(course => `
            <div class="course-item" onclick="showCourse(${course.id})">
                <h3>${course.title}</h3>
                <p><strong>Author ID:</strong> ${course.authorId}</p>
                <p><strong>Description:</strong> ${course.description || 'No description'}</p>
                <p><strong>Created:</strong> ${course.creationDate}</p>
                <p><strong>Last Updated:</strong> ${course.lastUpdateDate}</p>
            </div>
        `).join('') || '<p>No courses found.</p>';
    } catch (err) {
        showError('Failed to search courses: ' + err.message);
    }
}

async function createLesson(courseId) {
    const title = document.getElementById('lesson-title').value;
    const sequenceNumber = document.getElementById('lesson-seq').value;
    const description = document.getElementById('lesson-desc').value;
    const content = document.getElementById('lesson-content').value;
    try {
        await fetchWithAuth('/lessons/create', {
            method: 'POST',
            body: JSON.stringify({ title, courseId, sequenceNumber: parseInt(sequenceNumber), description, content })
        });
        closeModal();
        showCourse(courseId);
    } catch (err) {
        showError('Failed to create lesson: ' + err.message);
    }
}

async function createCourse() {
    const title = document.getElementById('course-title').value;
    const description = document.getElementById('course-desc').value;
    try {
        await fetchWithAuth('/courses/create', {
            method: 'POST',
            body: JSON.stringify({ title, authorId: userId, description })
        });
        closeModal();
        showCourses();
    } catch (err) {
        showError('Failed to create course: ' + err.message);
    }
}

async function updateCourse(courseId) {
    const title = document.getElementById('edit-course-title').value;
    const description = document.getElementById('edit-course-desc').value;
    try {
        await fetchWithAuth(`/courses/edit/${courseId}`, {
            method: 'PUT',
            body: JSON.stringify({ title, authorId: userId, description })
        });
        closeModal();
        showCourse(courseId);
    } catch (err) {
        showError('Failed to update course: ' + err.message);
    }
}

async function updateLesson(lessonId, courseId) {
    const title = document.getElementById('edit-lesson-title').value;
    const sequenceNumber = document.getElementById('edit-lesson-seq').value;
    const description = document.getElementById('edit-lesson-desc').value;
    const content = document.getElementById('edit-lesson-content').value;
    try {
        await fetchWithAuth(`/lessons/edit/${lessonId}`, {
            method: 'PUT',
            body: JSON.stringify({ 
                title, 
                courseId, 
                sequenceNumber: parseInt(sequenceNumber), 
                description, 
                content 
            })
        });
        closeModal();
        showLesson(lessonId);
    } catch (err) {
        showError('Failed to update lesson: ' + err.message);
    }
}

async function deleteCourse(courseId) {
    if (confirm('Are you sure you want to delete this course?')) {
        try {
            await fetchWithAuth(`/courses/delete/${courseId}`, { method: 'DELETE' });
            showCourses();
        } catch (err) {
            showError('Failed to delete course: ' + err.message);
        }
    }
}

async function deleteLesson(lessonId) {
    if (confirm('Are you sure you want to delete this lesson?')) {
        try {
            const lesson = await fetchWithAuth(`/lessons/${lessonId}`);
            await fetchWithAuth(`/lessons/delete/${lessonId}`, { method: 'DELETE' });
            showCourse(lesson.courseId);
        } catch (err) {
            showError('Failed to delete lesson: ' + err.message);
        }
    }
}

async function enrollCourse() {
    console.log(`Enrolling in course: ${currentCourseId}`);

    if (!currentCourseId) return;
    const button = event.target;
    const originalText = button.textContent;
            
    try {
        button.disabled = true;
                
        await fetchWithAuth(`/enroll?studentId=${userId}&courseId=${currentCourseId}`, { 
            method: 'POST' 
        });
                
        userEnrollments = await fetchWithAuth(`/enroll/student/${userId}`);

        await showCourse(currentCourseId);
    } catch (err) {
        if (err.message.includes('409')) {
            userEnrollments = await fetchWithAuth(`/enroll/student/${userId}`);
            await showCourse(currentCourseId);
        } else {
            showError('Failed to enroll in course: ' + err.message);
        }
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

async function leaveCourse() {
    if (!currentCourseId) return;
    const button = event.target;
    const originalText = button.textContent;
            
    try {
        button.disabled = true;
                
        const isEnrolled = userEnrollments.some(e => 
            e.enrollmentId?.courseId === currentCourseId || 
            e.courseId === currentCourseId
        );
                
        if (!isEnrolled) {
            await showCourse(currentCourseId);
            return;
        }

        await fetchWithAuth(`/leave?studentId=${userId}&courseId=${currentCourseId}`, { 
            method: 'DELETE' 
        });
                
        userEnrollments = await fetchWithAuth(`/enroll/student/${userId}`);

        await showCourse(currentCourseId);
    } catch (err) {
        if (err.message.includes('404')) {
            userEnrollments = await fetchWithAuth(`/enroll/student/${userId}`);
            await showCourse(currentCourseId);
        } else {
            showError('Failed to leave course: ' + err.message);
        }
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

function logout() {
    if (token) {
        const payload = decodeJWT(token);
        fetchWithAuth(`/auth/logout?emailAddress=${payload.sub}`, { method: 'POST' })
            .catch(() => {});
    }
    token = null;
    localStorage.removeItem('token');
    showHome();
}

showHome();