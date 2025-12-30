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
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    try {
        const res = await fetch(`${API_BASE_URL}${url}`, { 
            ...options, 
            headers: { ...headers, ...options.headers }
        });
        
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
        
        if (res.headers.get('content-type')?.includes('application/octet-stream')) {
            return res;
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

let currentLessonId = null;

async function showLesson(lessonId) {
    try {
        currentLessonId = lessonId;
        const lesson = await fetchWithAuth(`/lessons/${lessonId}`);
        const course = await fetchWithAuth(`/courses/${lesson.courseId}`);
        let assignments = [];
        
        try {
            assignments = await fetchWithAuth(`/assignments/lesson/${lessonId}`);
            if (!Array.isArray(assignments)) {
                assignments = [];
            }
        } catch (err) {
            console.log('No assignments or error fetching assignments:', err.message);
            assignments = [];
        }
        
        const isAuthor = userId === course.authorId;
        
        const fileAssignments = assignments.filter(a => a.displayFilename !== undefined) || [];
        const testAssignments = assignments.filter(a => a.condition !== undefined || 
                                                       (a.options && a.correctOptionsIndices)) || [];
        
        let submissions = [];
        if (token && !isAuthor) {
            try {
                submissions = await fetchWithAuth(`/submissions/query/assignment/${assignmentId}/studentId/${userId}`);
                if (!Array.isArray(submissions)) {
                    submissions = [];
                }
            } catch (err) {
                console.log('No submissions found:', err.message);
            }
        }
        
        document.getElementById('content').innerHTML = `
            <div class="lesson-content-wrapper">
                <h1>${lesson.title}</h1>
                <div class="card">
                    <p>${lesson.description || 'No description'}</p>
                </div>
                ${lesson.content ? `
                    <div class="lesson-text-content">${lesson.content.replace(/\n/g, '<br>')}</div>
                ` : ''}
                
                <h2>Assignments</h2>
                <div class="assignment-list">
                    ${assignments.length === 0 ? 
                        '<p>No assignments available.</p>' : ''}
                    
                    ${fileAssignments.map(assignment => `
                        <div class="assignment-item" onclick="showFileAssignment(${assignment.id})">
                            <h3>📎 ${assignment.title}</h3>
                            <p><strong>Type:</strong> File Submission</p>
                            <p><strong>Max Score:</strong> ${assignment.maxScore || 0}</p>
                            <p><strong>Deadline:</strong> ${new Date(assignment.deadline).toLocaleString()}</p>
                            ${assignment.displayFilename ? `<p><strong>File:</strong> ${assignment.displayFilename}</p>` : ''}
                        </div>
                    `).join('')}
                    
                    ${testAssignments.map(assignment => `
                        <div class="assignment-item" onclick="showTestAssignment(${assignment.id})">
                            <h3>📝 ${assignment.title}</h3>
                            <p><strong>Type:</strong> Test</p>
                            <p><strong>Max Score:</strong> ${assignment.maxScore || 0}</p>
                            <p><strong>Deadline:</strong> ${new Date(assignment.deadline).toLocaleString()}</p>
                        </div>
                    `).join('')}
                </div>
                
                ${isAuthor ? `
                    <div class="card">
                        <h3>Create New Assignment</h3>
                        <button onclick="showCreateFileAssignment(${lessonId})">Create File Assignment</button>
                        <button onclick="showCreateTestAssignment(${lessonId})">Create Test Assignment</button>
                    </div>
                ` : ''}
                
                ${!isAuthor && submissions.length > 0 ? `
                    <div class="submission-section">
                        <h3>My Submissions</h3>
                        ${submissions.map(sub => `
                            <div class="submission-item ${sub.score !== null ? 'graded' : 'pending'}">
                                <p><strong>Assignment:</strong> ${sub.assignmentTitle || 'Unknown'}</p>
                                <p><strong>Submitted:</strong> ${new Date(sub.submissionDate).toLocaleString()}</p>
                                ${sub.score !== null ? 
                                    `<p><strong>Score:</strong> ${sub.score}/${sub.maxScore || 0}</p>` : 
                                    '<p><strong>Status:</strong> Pending review</p>'}
                                ${sub.feedback ? `<p><strong>Feedback:</strong> ${sub.feedback}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
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
        console.error('Error details:', err);
    }
}

function showCreateFileAssignment(lessonId) {
    showModal(`
        <h2>Create File Assignment</h2>
        <div class="form-group">
            <label for="fa_title">Title *</label>
            <input id="fa_title" type="text" placeholder="Enter assignment title" required>
        </div>
        <div class="form-group">
            <label for="fa_description">Description</label>
            <textarea id="fa_description" placeholder="Enter description"></textarea>
        </div>
        <div class="form-group">
            <label for="fa_maxScore">Max Score *</label>
            <input id="fa_maxScore" type="number" placeholder="Enter max score" required>
        </div>
        <div class="form-group">
            <label for="fa_deadline">Deadline (yyyy-MM-dd HH:mm:ss) *</label>
            <input id="fa_deadline" type="text" placeholder="2024-12-31 23:59:59" required>
        </div>
        <div class="form-group">
            <label for="fa_displayFilename">Display Filename</label>
            <input id="fa_displayFilename" type="text" placeholder="Optional display filename">
        </div>
        <div class="form-group">
            <label for="fa_file">File *</label>
            <input id="fa_file" type="file" required>
        </div>
        <button onclick="createFileAssignment(${lessonId})">Create</button>
        <button onclick="closeModal()">Cancel</button>
    `);
}

function showCreateTestAssignment(lessonId) {
    showModal(`
        <h2>Create Test Assignment</h2>
        <div class="form-group">
            <label for="ta_title">Title *</label>
            <input id="ta_title" type="text" placeholder="Enter assignment title" required>
        </div>
        <div class="form-group">
            <label for="ta_description">Description</label>
            <textarea id="ta_description" placeholder="Enter description"></textarea>
        </div>
        <div class="form-group">
            <label for="ta_maxScore">Max Score *</label>
            <input id="ta_maxScore" type="number" placeholder="Enter max score" required>
        </div>
        <div class="form-group">
            <label for="ta_deadline">Deadline (yyyy-MM-dd HH:mm:ss) *</label>
            <input id="ta_deadline" type="text" placeholder="2024-12-31 23:59:59" required>
        </div>
        <div class="form-group">
            <label for="ta_condition">Question/Condition *</label>
            <textarea id="ta_condition" placeholder="Enter test question or condition" required></textarea>
        </div>
        <div class="form-group">
            <label for="ta_options">Options (one per line) *</label>
            <textarea id="ta_options" placeholder="Option 1&#10;Option 2&#10;Option 3" required></textarea>
        </div>
        <div class="form-group">
            <label for="ta_correct">Correct Indices (comma separated, 0-based) *</label>
            <input id="ta_correct" type="text" placeholder="0,2" required>
        </div>
        <button onclick="createTestAssignment(${lessonId})">Create</button>
        <button onclick="closeModal()">Cancel</button>
    `);
}

async function showFileAssignment(assignmentId) {
    try {
        const assignment = await fetchWithAuth(`/assignments/${assignmentId}`);
        console.log('File assignment response:', assignment);
        
        const lesson = await fetchWithAuth(`/lessons/${assignment.lessonId}`);
        const course = await fetchWithAuth(`/courses/${lesson.courseId}`);
        const isAuthor = userId === course.authorId;
        
        let userSubmission = null;
        if (token && !isAuthor) {
            try {
                const submissions = await fetchWithAuth(`/submissions/query/assignment/${assignmentId}/studentId/${userId}`);
                if (Array.isArray(submissions) && submissions.length > 0) {
                    userSubmission = submissions[0];
                }
            } catch (err) {
                console.log('No submission found:', err.message);
            }
        }
        
        let allSubmissions = [];
        if (isAuthor) {
            try {
                allSubmissions = await fetchWithAuth(`/submissions/query/assignment/${assignmentId}`);
                if (!Array.isArray(allSubmissions)) {
                    allSubmissions = [];
                }
            } catch (err) {
                console.log('No submissions found:', err.message);
            }
        }
        
        document.getElementById('content').innerHTML = `
            <h1>${assignment.title || 'Untitled Assignment'}</h1>
            <div class="assignment-info">
                <p><strong>Type:</strong> File Assignment</p>
                <p><strong>Lesson:</strong> <a href="javascript:showLesson(${assignment.lessonId})">View Lesson</a></p>
                <p><strong>Description:</strong> ${assignment.description || 'No description'}</p>
                <p><strong>Max Score:</strong> ${assignment.maxScore || 0}</p>
                <p><strong>Deadline:</strong> ${new Date(assignment.deadline).toLocaleString()}</p>
                ${assignment.displayFilename ? `
                    <div class="file-info">
                        <svg width="16" height="16" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span>File: ${assignment.displayFilename}</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="card">
                <button onclick="downloadAssignmentFile(${assignmentId})">Download File</button>
                ${isAuthor ? `
                    <button onclick="showEditFileAssignmentModal(${assignmentId})">Edit Assignment</button>
                    <button onclick="showUpdateAssignmentFileModal(${assignmentId})">Update File</button>
                    <button onclick="deleteFileAssignment(${assignmentId})">Delete Assignment</button>
                ` : ''}
                <button onclick="showLesson(${assignment.lessonId})">Back to Lesson</button>
            </div>
            
            ${!isAuthor && !userSubmission ? `
                <div class="card">
                    <h3>Submit Your Work</h3>
                    <div class="form-group">
                        <label for="submission_file">Upload your file *</label>
                        <input id="submission_file" type="file" required>
                    </div>
                    <div class="form-group">
                        <label for="submission_comment">Comment (optional)</label>
                        <textarea id="submission_comment" placeholder="Any comments about your submission"></textarea>
                    </div>
                    <button onclick="submitFileAssignment(${assignmentId})">Submit</button>
                </div>
            ` : ''}
            
            ${!isAuthor && userSubmission ? `
                <div class="card">
                    <h3>Your Submission</h3>
                    <div class="submission-item ${userSubmission.score !== null ? 'graded' : 'pending'}">
                        <p><strong>Submitted:</strong> ${new Date(userSubmission.submissionDate).toLocaleString()}</p>
                        ${userSubmission.score !== null ? `
                            <p><strong>Score:</strong> ${userSubmission.score}/${userSubmission.maxScore || assignment.maxScore || 0}</p>
                            ${userSubmission.feedback ? `<p><strong>Feedback:</strong> ${userSubmission.feedback}</p>` : ''}
                        ` : '<p><strong>Status:</strong> Pending review</p>'}
                        ${userSubmission.comment ? `<p><strong>Your Comment:</strong> ${userSubmission.comment}</p>` : ''}
                    </div>
                </div>
            ` : ''}
            
            ${isAuthor && allSubmissions.length > 0 ? `
                <div class="card">
                    <h3>Student Submissions (${allSubmissions.length})</h3>
                    ${allSubmissions.map(sub => `
                        <div class="submission-item ${sub.score !== null ? 'graded' : 'pending'}">
                            <p><strong>Student ID:</strong> ${sub.studentId || 'Unknown'}</p>
                            <p><strong>Submitted:</strong> ${new Date(sub.submissionDate).toLocaleString()}</p>
                            ${sub.comment ? `<p><strong>Comment:</strong> ${sub.comment}</p>` : ''}
                            ${sub.score !== null ? `
                                <p><strong>Score:</strong> ${sub.score}/${sub.maxScore || assignment.maxScore || 0}</p>
                                ${sub.feedback ? `<p><strong>Feedback:</strong> ${sub.feedback}</p>` : ''}
                            ` : `
                                <div class="form-group">
                                    <label for="score_${sub.id}">Score (0-${assignment.maxScore || 0})</label>
                                    <input id="score_${sub.id}" type="number" min="0" max="${assignment.maxScore || 0}" value="${sub.score || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="feedback_${sub.id}">Feedback</label>
                                    <textarea id="feedback_${sub.id}">${sub.feedback || ''}</textarea>
                                </div>
                                <button onclick="gradeSubmission(${sub.id}, ${assignmentId})">Grade</button>
                            `}
                            <button onclick="downloadSubmissionFile(${sub.id})">Download Submission</button>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
        renderNavbar();
    } catch (err) {
        showError('Failed to load assignment: ' + err.message);
        console.error('Error details:', err);
    }
}


async function showTestAssignment(assignmentId) {
    try {
        const assignment = await fetchWithAuth(`/assignments/${assignmentId}`);
        console.log('Test assignment response:', assignment);
        
        if (!assignment.condition && !assignment.options) {
            showError('This is not a test assignment');
            return;
        }
        
        const lesson = await fetchWithAuth(`/lessons/${assignment.lessonId}`);
        const course = await fetchWithAuth(`/courses/${lesson.courseId}`);
        const isAuthor = userId === course.authorId;
        
        let userSubmission = null;
        if (token && !isAuthor) {
            try {
                const submissions = await fetchWithAuth(`/submissions/query/assignment/${assignmentId}/student/${userId}`);
                if (Array.isArray(submissions) && submissions.length > 0) {
                    userSubmission = submissions[0];
                }
            } catch (err) {
                console.log('No submission found:', err.message);
            }
        }
        
        let allSubmissions = [];
        if (isAuthor) {
            try {
                allSubmissions = await fetchWithAuth(`/submissions/query/assignment/${assignmentId}`);
                if (!Array.isArray(allSubmissions)) {
                    allSubmissions = [];
                }
            } catch (err) {
                console.log('No submissions found:', err.message);
            }
        }
        
        const options = Array.isArray(assignment.options) ? assignment.options : [];
        const correctOptionsIndices = Array.isArray(assignment.correctOptionsIndices) ? 
            assignment.correctOptionsIndices : [];
        
        document.getElementById('content').innerHTML = `
            <h1>${assignment.title || 'Untitled Test'}</h1>
            <div class="assignment-info">
                <p><strong>Type:</strong> Test Assignment</p>
                <p><strong>Lesson:</strong> <a href="javascript:showLesson(${assignment.lessonId})">View Lesson</a></p>
                <p><strong>Description:</strong> ${assignment.description || 'No description'}</p>
                <p><strong>Max Score:</strong> ${assignment.maxScore || 0}</p>
                <p><strong>Deadline:</strong> ${new Date(assignment.deadline).toLocaleString()}</p>
            </div>
            
            <div class="card">
                <h3>Question</h3>
                <p>${assignment.condition || 'No question provided'}</p>
                
                <h3>Options</h3>
                <div class="test-options">
                    ${options.map((option, index) => `
                        <div class="option-item ${isAuthor && correctOptionsIndices.includes(index) ? 'correct' : ''}">
                            ${String.fromCharCode(65 + index)}. ${option}
                            ${isAuthor && correctOptionsIndices.includes(index) ? ' ✓' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="card">
                ${isAuthor ? `
                    <button onclick="showEditTestAssignmentModal(${assignmentId})">Edit Assignment</button>
                    <button onclick="deleteTestAssignment(${assignmentId})">Delete Assignment</button>
                ` : ''}
                <button onclick="showLesson(${assignment.lessonId})">Back to Lesson</button>
            </div>
            
            ${!isAuthor && !userSubmission ? `
                <div class="card">
                    <h3>Take the Test</h3>
                    <div class="form-group">
                        <label>Select your answer(s):</label>
                        ${options.map((option, index) => `
                            <div>
                                <input type="checkbox" id="answer_${index}" name="answers" value="${index}">
                                <label for="answer_${index}">${String.fromCharCode(65 + index)}. ${option}</label>
                            </div>
                        `).join('')}
                    </div>
                    <button onclick="submitTestAssignment(${assignmentId})">Submit Test</button>
                </div>
            ` : ''}
            
            ${!isAuthor && userSubmission ? `
                <div class="card">
                    <h3>Your Test Result</h3>
                    <div class="submission-item ${userSubmission.score !== null ? 'graded' : 'pending'}">
                        <p><strong>Submitted:</strong> ${new Date(userSubmission.submissionDate).toLocaleString()}</p>
                        <p><strong>Your Answers:</strong> ${Array.isArray(userSubmission.selectedOptionsIndices) ? 
                            userSubmission.selectedOptionsIndices.join(', ') : 'None'}</p>
                        ${userSubmission.score !== null ? `
                            <p><strong>Score:</strong> ${userSubmission.score}/${userSubmission.maxScore || assignment.maxScore || 0}</p>
                            ${userSubmission.feedback ? `<p><strong>Feedback:</strong> ${userSubmission.feedback}</p>` : ''}
                        ` : '<p><strong>Status:</strong> Pending review</p>'}
                    </div>
                </div>
            ` : ''}
            
            ${isAuthor && allSubmissions.length > 0 ? `
                <div class="card">
                    <h3>Student Results (${allSubmissions.length})</h3>
                    ${allSubmissions.map(sub => `
                        <div class="submission-item ${sub.score !== null ? 'graded' : 'pending'}">
                            <p><strong>Student ID:</strong> ${sub.studentId || 'Unknown'}</p>
                            <p><strong>Submitted:</strong> ${new Date(sub.submissionDate).toLocaleString()}</p>
                            <p><strong>Selected Answers:</strong> ${Array.isArray(sub.selectedOptionsIndices) ? 
                                sub.selectedOptionsIndices.join(', ') : 'None'}</p>
                            ${sub.score !== null ? `
                                <p><strong>Score:</strong> ${sub.score}/${sub.maxScore || assignment.maxScore || 0}</p>
                                ${sub.feedback ? `<p><strong>Feedback:</strong> ${sub.feedback}</p>` : ''}
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
        renderNavbar();
    } catch (err) {
        showError('Failed to load test assignment: ' + err.message);
        console.error('Error details:', err);
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
                        <small>Click to view lesson and assignments</small>
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

function showEditFileAssignmentModal(assignmentId) {
    fetchWithAuth(`/assignments/${assignmentId}`)
        .then(assignment => {
            showModal(`
                <h2>Edit File Assignment</h2>
                <div class="form-group">
                    <label for="ufa_title">Title *</label>
                    <input id="ufa_title" type="text" value="${assignment.title || ''}" required>
                </div>
                <div class="form-group">
                    <label for="ufa_description">Description</label>
                    <textarea id="ufa_description">${assignment.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="ufa_maxScore">Max Score *</label>
                    <input id="ufa_maxScore" type="number" value="${assignment.maxScore || 0}" required>
                </div>
                <div class="form-group">
                    <label for="ufa_deadline">Deadline (yyyy-MM-dd HH:mm:ss) *</label>
                    <input id="ufa_deadline" type="text" value="${assignment.deadline || ''}" required>
                </div>
                <div class="form-group">
                    <label for="ufa_displayFilename">Display Filename</label>
                    <input id="ufa_displayFilename" type="text" value="${assignment.displayFilename || ''}">
                </div>
                <button onclick="updateFileAssignment(${assignmentId})">Update</button>
                <button onclick="closeModal()">Cancel</button>
            `);
        })
        .catch(err => {
            showError('Failed to load assignment: ' + err.message);
            closeModal();
        });
}

function showUpdateAssignmentFileModal(assignmentId) {
    showModal(`
        <h2>Update Assignment File</h2>
        <div class="form-group">
            <label for="uf_displayFilename">Display Filename (optional)</label>
            <input id="uf_displayFilename" type="text" placeholder="New display filename">
        </div>
        <div class="form-group">
            <label for="uf_file">New File *</label>
            <input id="uf_file" type="file" required>
        </div>
        <button onclick="updateAssignmentFile(${assignmentId})">Update File</button>
        <button onclick="closeModal()">Cancel</button>
    `);
}

function showEditTestAssignmentModal(assignmentId) {
    fetchWithAuth(`/assignments/${assignmentId}`)
        .then(assignment => {
            showModal(`
                <h2>Edit Test Assignment</h2>
                <div class="form-group">
                    <label for="uta_title">Title *</label>
                    <input id="uta_title" type="text" value="${assignment.title || ''}" required>
                </div>
                <div class="form-group">
                    <label for="uta_description">Description</label>
                    <textarea id="uta_description">${assignment.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="uta_maxScore">Max Score *</label>
                    <input id="uta_maxScore" type="number" value="${assignment.maxScore || 0}" required>
                </div>
                <div class="form-group">
                    <label for="uta_deadline">Deadline (yyyy-MM-dd HH:mm:ss) *</label>
                    <input id="uta_deadline" type="text" value="${assignment.deadline || ''}" required>
                </div>
                <div class="form-group">
                    <label for="uta_condition">Question/Condition *</label>
                    <textarea id="uta_condition" required>${assignment.condition || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="uta_options">Options (one per line) *</label>
                    <textarea id="uta_options" required>${Array.isArray(assignment.options) ? assignment.options.join('\\n') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="uta_correct">Correct Indices (comma separated, 0-based) *</label>
                    <input id="uta_correct" type="text" value="${Array.isArray(assignment.correctOptionsIndices) ? assignment.correctOptionsIndices.join(',') : ''}" required>
                </div>
                <button onclick="updateTestAssignment(${assignmentId})">Update</button>
                <button onclick="closeModal()">Cancel</button>
            `);
        })
        .catch(err => {
            showError('Failed to load test assignment: ' + err.message);
            closeModal();
        });
}

async function createFileAssignment(lessonId) {
    const title = document.getElementById('fa_title').value;
    const description = document.getElementById('fa_description').value;
    const maxScore = document.getElementById('fa_maxScore').value;
    const deadline = document.getElementById('fa_deadline').value;
    const displayFilename = document.getElementById('fa_displayFilename').value;
    const file = document.getElementById('fa_file').files[0];
    
    if (!file) {
        showError('Please select a file');
        return;
    }
    
    const form = new FormData();
    form.append("data", new Blob([JSON.stringify({
        title,
        lessonId: Number(lessonId),
        description,
        maxScore: Number(maxScore),
        deadline,
        displayFilename
    })], { type: "application/json" }));
    form.append("file", file);
    
    try {
        await fetchWithAuth(`/assignments/file/create`, {
            method: "POST",
            body: form
        });
        closeModal();
        showLesson(lessonId);
    } catch (err) {
        showError('Failed to create file assignment: ' + err.message);
    }
}

async function updateFileAssignment(assignmentId) {
    const title = document.getElementById('ufa_title').value;
    const description = document.getElementById('ufa_description').value;
    const maxScore = document.getElementById('ufa_maxScore').value;
    const deadline = document.getElementById('ufa_deadline').value;
    const displayFilename = document.getElementById('ufa_displayFilename').value;
    
    try {
        await fetchWithAuth(`/assignments/file/edit/${assignmentId}`, {
            method: "PUT",
            body: JSON.stringify({
                title,
                lessonId: Number(currentLessonId),
                description,
                maxScore: Number(maxScore),
                deadline
            })
        });
        closeModal();
        showFileAssignment(assignmentId);
    } catch (err) {
        showError('Failed to update file assignment: ' + err.message);
    }
}


async function updateAssignmentFile(assignmentId) {
    const displayFilename = document.getElementById('uf_displayFilename').value;
    const file = document.getElementById('uf_file').files[0];
    
    if (!file) {
        showError('Please select a file');
        return;
    }
    
    const form = new FormData();
    if (displayFilename) form.append("displayFilename", displayFilename);
    form.append("file", file);
    
    try {
        await fetchWithAuth(`/assignments/file/update/${assignmentId}`, {
            method: "PUT",
            body: form
        });
        closeModal();
        showFileAssignment(assignmentId);
    } catch (err) {
        showError('Failed to update file: ' + err.message);
    }
}

async function createTestAssignment(lessonId) {
    const title = document.getElementById('ta_title').value;
    const description = document.getElementById('ta_description').value;
    const maxScore = document.getElementById('ta_maxScore').value;
    const deadline = document.getElementById('ta_deadline').value;
    const condition = document.getElementById('ta_condition').value;
    const options = document.getElementById('ta_options').value.split("\n").filter(o => o.trim());
    const correctOptionsIndices = document.getElementById('ta_correct').value.split(",").map(Number);
    
    try {
        await fetchWithAuth(`/assignments/test/create`, {
            method: "POST",
            body: JSON.stringify({
                title,
                lessonId: Number(lessonId),
                description,
                maxScore: Number(maxScore),
                deadline,
                condition,
                options,
                correctOptionsIndices
            })
        });
        closeModal();
        showLesson(lessonId);
    } catch (err) {
        showError('Failed to create test assignment: ' + err.message);
    }
}

async function updateTestAssignment(assignmentId) {
    const title = document.getElementById('uta_title').value;
    const description = document.getElementById('uta_description').value;
    const maxScore = document.getElementById('uta_maxScore').value;
    const deadline = document.getElementById('uta_deadline').value;
    const condition = document.getElementById('uta_condition').value;
    const options = document.getElementById('uta_options').value.split("\n").filter(o => o.trim());
    const correctOptionsIndices = document.getElementById('uta_correct').value.split(",").map(Number);
    
    try {
        await fetchWithAuth(`/assignments/test/edit/${assignmentId}`, {
            method: "PUT",
            body: JSON.stringify({
                title,
                lessonId: Number(currentLessonId),
                description,
                maxScore: Number(maxScore),
                deadline,
                condition,
                options,
                correctOptionsIndices
            })
        });
        closeModal();
        showTestAssignment(assignmentId);
    } catch (err) {
        showError('Failed to update test assignment: ' + err.message);
    }
}

async function deleteFileAssignment(assignmentId) {
    if (confirm('Are you sure you want to delete this file assignment?')) {
        try {
            await fetchWithAuth(`/assignments/file/delete/${assignmentId}`, { method: 'DELETE' });
            showLesson(currentLessonId);
        } catch (err) {
            showError('Failed to delete file assignment: ' + err.message);
        }
    }
}

async function deleteTestAssignment(assignmentId) {
    if (confirm('Are you sure you want to delete this test assignment?')) {
        try {
            await fetchWithAuth(`/assignments/test/delete/${assignmentId}`, { method: 'DELETE' });
            showLesson(currentLessonId);
        } catch (err) {
            showError('Failed to delete test assignment: ' + err.message);
        }
    }
}

async function downloadAssignmentFile(assignmentId) {
    try {
        const res = await fetchWithAuth(`/assignments/file/${assignmentId}/download`);
        
        if (!res.ok) {
            throw new Error(`Download failed: ${res.status}`);
        }
        
        const blob = await res.blob();
        let filename = "assignment_file.bin";
        
        const cd = res.headers.get("Content-Disposition");
        if (cd && cd.includes("filename=")) {
            filename = cd.split("filename=")[1].replace(/"/g, "");
        }
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        showError('Failed to download file: ' + err.message);
    }
}

async function submitFileAssignment(assignmentId) {
    const file = document.getElementById('submission_file').files[0];
    const displayFilename = document.getElementById('submission_comment').value;
    
    if (!file) {
        showError('Please select a file to submit');
        return;
    }
    
    const form = new FormData();
    
    form.append("data", new Blob([JSON.stringify({
        assignmentId: Number(assignmentId),
        studentId: userId,
        displayFilename: displayFilename
    })], { type: "application/json" }));
    form.append("file", file);
    
    try {
        await fetchWithAuth(`/submissions/file/upload`, {
            method: "POST",
            body: form
        });
        showSuccess('Submission successful!');
        showFileAssignment(assignmentId);
    } catch (err) {
        showError('Failed to submit assignment: ' + err.message);
    }
}

async function submitTestAssignment(assignmentId) {
    const checkboxes = document.querySelectorAll('input[name="answers"]:checked');
    const selectedOptionsIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    try {
        await fetchWithAuth(`/submissions/test/complete-test`, {
            method: "POST",
            body: JSON.stringify({
                assignmentId: Number(assignmentId),
                studentId: userId,
                selectedOptionsIndices
            })
        });
        showSuccess('Test submitted successfully!');
        showTestAssignment(assignmentId);
    } catch (err) {
        showError('Failed to submit test: ' + err.message);
    }
}

async function gradeSubmission(submissionId, assignmentId) {
    const score = document.getElementById(`score_${submissionId}`).value;
    const feedback = document.getElementById(`feedback_${submissionId}`).value;
    
    try {
        await fetchWithAuth(`/submissions/review/${submissionId}`, {
            method: "POST",
            body: JSON.stringify({
                score: Number(score),
                feedback
            })
        });
        showSuccess('Graded successfully!');
        showFileAssignment(assignmentId);
    } catch (err) {
        showError('Failed to grade submission: ' + err.message);
    }
}

async function downloadSubmissionFile(submissionId) {
    try {
        const res = await fetchWithAuth(`/submissions/file/${submissionId}/download`);
        
        if (!res.ok) {
            throw new Error(`Download failed: ${res.status}`);
        }
        
        const blob = await res.blob();
        let filename = "submission.bin";
        
        const cd = res.headers.get("Content-Disposition");
        if (cd && cd.includes("filename=")) {
            filename = cd.split("filename=")[1].replace(/"/g, "");
        }
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        showError('Failed to download submission: ' + err.message);
    }
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