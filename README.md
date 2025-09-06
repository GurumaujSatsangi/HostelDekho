<h1>HostelDekho</h1>

<h3>Project Overview</h3>
<p>
HostelDekho is a pioneering web application designed to centralize and provide real-time information on hostels and rooms for students at VIT Vellore. Addressing the current lack of a unified platform, this project streamlines the hostel counselling process by offering a comprehensive, community-driven resource. Students can securely log in to access detailed hostel information and contribute valuable user-generated data, such as Wi-Fi speeds, room conditions, and personal remarks.
</p>

<h3>Key Features</h3>
<ul>
  <li><b>Secure Authentication:</b> User authentication is handled via OAuth, ensuring a secure and seamless login experience for students.</li>
  <li><b>Comprehensive Hostel Directory:</b> Browse and filter detailed information for all hostels and individual rooms.</li>
  <li><b>Community-Powered Data:</b> Authenticated users can contribute and update real-time data points, including:
    <ul>
      <li>Wi-Fi speed metrics</li>
      <li>Qualitative room condition ratings</li>
      <li>General remarks or tips for future residents</li>
    </ul>
  </li>
  <li><b>Scalable Architecture:</b> The backend is built on Node.js and Express, providing a robust and scalable foundation.</li>
  <li><b>Reliable Data Storage:</b> Data is persisted using Supabase, a powerful open-source database solution.</li>
  <li><b>Efficient File Management:</b> File storage for any potential uploads is managed on Microsoft Azure, ensuring high availability and performance.</li>
</ul>

<h3>Technical Stack</h3>
<ul>
  <li><b>Backend:</b> Node.js, Express.js</li>
  <li><b>Database:</b> Supabase</li>
  <li><b>File Storage:</b> Microsoft Azure Blob Storage</li>
  <li><b>Authentication:</b> OAuth 2.0</li>
  <li><b>Deployment:</b> Containerized and deployed on cloud platforms such as Azure or Vercel</li>
</ul>

<h3>Getting Started</h3>

<h4>Prerequisites</h4>
<ul>
  <li>Node.js (LTS version recommended)</li>
  <li>npm (or yarn)</li>
  <li>Git</li>
</ul>

<h4>Installation</h4>
<pre>
git clone https://github.com/your-username/hosteldekho.git
cd hosteldekho
npm install
</pre>

<h4>Configuration</h4>
<p>
The project uses environment variables for sensitive information. Create a <code>.env</code> file in the root directory of the project and populate it with your credentials:
</p>

<pre>
# Supabase Configuration
SUPABASE_URL="[Your Supabase Project URL]"
SUPABASE_SERVICE_ROLE_KEY="[Your Supabase Service Role Key]"

# Azure Blob Storage Configuration
AZURE_STORAGE_CONNECTION_STRING="[Your Azure Storage Connection String]"
AZURE_CONTAINER_NAME="[Your Azure Container Name]"

# OAuth Configuration (Example: Google)
OAUTH_CLIENT_ID="[Your OAuth Client ID]"
OAUTH_CLIENT_SECRET="[Your OAuth Client Secret]"
OAUTH_CALLBACK_URL="[Your OAuth Callback URL]"
</pre>

<h4>Running the Application</h4>
<pre>
npm start
</pre>
<p>
The server will run on the port specified in your <code>.env</code> file (e.g., <a href="http://localhost:3000" target="_blank">http://localhost:3000</a>).
</p>

<h3>API Endpoints</h3>
<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Description</th>
      <th>Authentication Required</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>POST</td>
      <td>/auth/login</td>
      <td>Initiates the OAuth login flow.</td>
      <td>No</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/hostels</td>
      <td>Retrieves a list of all hostels.</td>
      <td>No</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/hostels/:id</td>
      <td>Retrieves detailed information for a specific hostel.</td>
      <td>No</td>
    </tr>
    <tr>
      <td>POST</td>
      <td>/api/rooms/:roomId/details</td>
      <td>Adds or updates user-submitted details for a room.</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/rooms/:roomId/details</td>
      <td>Retrieves user-submitted details for a room.</td>
      <td>No</td>
    </tr>
  </tbody>
</table>

<h3>Contact</h3>
<p>
For any inquiries or feedback, please feel free to reach out to me at 
<a href="mailto:gurumaujsatsangi@gmail.com">gurumaujsatsangi@gmail.com</a>.
</p>
