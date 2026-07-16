import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ShieldAlert, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { authService, patientService } from '../services/api';

function Login({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Registration states (for patient creation)
  const [regRole, setRegRole] = useState('Patient'); // Patient or Receptionist
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [mobile, setMobile] = useState('');

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const data = await authService.login(username, password);
      onLoginSuccess({
        token: data.access_token,
        role: data.role,
        username: data.username
      });
      navigate(`/${data.role.toLowerCase()}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Incorrect username or password. Try admin/admin123 or receptionist/recep123');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in username and password');
      return;
    }

    if (regRole === 'Patient' && (!name || !age || !mobile)) {
      setError('Please fill in Patient Name, Age, and Mobile number');
      return;
    }

    setError('');
    setLoading(true);
    try {
      if (regRole === 'Patient') {
        // Register patient profile directly (it handles credential creation internally)
        await patientService.register(name, age, gender, mobile, username, password);
      } else {
        // Register generic user (receptionist)
        await authService.register(username, password, regRole);
      }
      
      // Auto login after successful registration
      const data = await authService.login(username, password);
      onLoginSuccess({
        token: data.access_token,
        role: data.role,
        username: data.username
      });
      navigate(`/${data.role.toLowerCase()}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Registration failed. Username may already be taken.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-12">
      <div className="relative py-3 w-full max-w-lg sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-hospital-400 to-hospital-600 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl sm:p-12">
          
          <div className="text-center pb-6">
            <div className="inline-flex bg-hospital-100 dark:bg-hospital-950 p-3 rounded-full text-hospital-500 mb-2">
              <Activity className="h-8 w-8 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              {isRegistering ? 'Create AcuraQueue Account' : 'Welcome to AcuraQueue'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isRegistering 
                ? 'Register to track estimation queues online' 
                : 'Sign in to access your customized dashboard'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-600 dark:text-rose-400 text-sm flex items-center space-x-2">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-hospital-500 focus:border-transparent outline-none transition-all text-sm"
                placeholder="e.g. johndoe"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-hospital-500 focus:border-transparent outline-none transition-all text-sm"
                placeholder="••••••••"
              />
            </div>

            {isRegistering && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">ACCOUNT TYPE</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-hospital-500 focus:border-transparent outline-none text-sm"
                  >
                    <option value="Patient">Patient</option>
                    <option value="Receptionist">Receptionist</option>
                  </select>
                </div>

                {regRole === 'Patient' && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <h3 className="text-sm font-semibold text-hospital-500">Patient Profile Details</h3>
                    
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">FULL NAME</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-hospital-500 focus:border-transparent outline-none text-sm"
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">AGE</label>
                        <input
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-hospital-500 focus:border-transparent outline-none text-sm"
                          placeholder="30"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">GENDER</label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-hospital-500 focus:border-transparent outline-none text-sm"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">MOBILE NUMBER</label>
                      <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-hospital-500 focus:border-transparent outline-none text-sm"
                        placeholder="9876543210"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-hospital-500 text-white font-semibold py-3 rounded-xl shadow-md hover:bg-hospital-600 transition-colors flex items-center justify-center space-x-2 text-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{isRegistering ? 'Register' : 'Login'}</span>
                  {isRegistering ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm border-t border-slate-200 dark:border-slate-800 pt-4">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-hospital-500 dark:text-hospital-400 font-semibold hover:underline inline-flex items-center space-x-1"
            >
              <span>{isRegistering ? 'Already have an account? Sign In' : 'New Patient? Create an Account'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {!isRegistering && (
            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-2xl text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <span className="font-semibold block mb-0.5">Demo Credentials:</span>
              <div className="flex justify-between"><span>Admin:</span> <strong>admin / admin123</strong></div>
              <div className="flex justify-between"><span>Receptionist:</span> <strong>receptionist / recep123</strong></div>
              <div className="flex justify-between"><span>Doctor (General):</span> <strong>drhouse / doctor123</strong></div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default Login;
