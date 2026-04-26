import React, { useState } from 'react';
// @ts-ignore
import './LoginForm.css';

const LoginForm: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);

    const toggleForm = () => setIsSignUp(!isSignUp);

    return (
        <div className="section">
            <div className="container">
                <div className="row full-height justify-content-center">
                    <div className="col-12 text-center align-self-center py-5">
                        <div className="section pb-5 pt-5 pt-sm-2 text-center">
                            <h6 className="mb-0 pb-3">
                                <span>Log In </span>
                                <span>Sign Up</span>
                            </h6>

                            <input
                                className="checkbox"
                                type="checkbox"
                                id="reg-log"
                                name="reg-log"
                                checked={isSignUp}
                                onChange={toggleForm}
                            />
                            <label htmlFor="reg-log"></label>

                            <div className="card-3d-wrap mx-auto">
                                <div className={`card-3d-wrapper ${isSignUp ? 'show-back' : ''}`}>

                                    {/* Lado da Frente: Login */}
                                    <div className="card-front">
                                        <div className="center-wrap">
                                            <div className="section text-center">
                                                <h4 className="mb-4 pb-3">Log In</h4>
                                                <div className="form-group">
                                                    <input type="email" name="logemail" className="form-style" placeholder="Your Email" id="logemail" />
                                                    <i className="input-icon uil uil-at"></i>
                                                </div>
                                                <div className="form-group mt-2">
                                                    <input type="password" name="logpass" className="form-style" placeholder="Your Password" id="logpass" />
                                                    <i className="input-icon uil uil-lock-alt"></i>
                                                </div>
                                                <button className="btn mt-4">Submit</button>
                                                <p className="mb-0 mt-4 text-center">
                                                    <a href="#0" className="link">Forgot your password?</a>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Lado de Trás: Sign Up */}
                                    <div className="card-back">
                                        <div className="center-wrap">
                                            <div className="section text-center">
                                                <h4 className="mb-4 pb-3">Sign Up</h4>
                                                <div className="form-group">
                                                    <input type="text" name="logname" className="form-style" placeholder="Your Full Name" id="logname" />
                                                    <i className="input-icon uil uil-user"></i>
                                                </div>
                                                <div className="form-group mt-2">
                                                    <input type="email" name="logemail" className="form-style" placeholder="Your Email" id="logemail-signup" />
                                                    <i className="input-icon uil uil-at"></i>
                                                </div>
                                                <div className="form-group mt-2">
                                                    <input type="password" name="logpass" className="form-style" placeholder="Your Password" id="logpass-signup" />
                                                    <i className="input-icon uil uil-lock-alt"></i>
                                                </div>
                                                <button className="btn mt-4">Submit</button>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;