import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { API_CLIENT } from '@/lib/api-client';

export const RegisterForm: React.FC = () => {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams();
  const emailParam = (params.email as string) || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState(emailParam);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [otp, setOtp] = useState('');

  const handleRegister = async () => {
    if (!name.trim()) return toast.show('Please enter your name', 'error');
    if (!email.trim()) return toast.show('Please enter your email', 'error');
    if (!phone.trim() || phone.trim().length < 10) return toast.show('Please enter a valid 10-digit phone number', 'error');
    if (!password.trim() || password.length < 6) return toast.show('Password must be at least 6 characters', 'error');

    setLoading(true);
    try {
      const { data } = await API_CLIENT.post('/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password: password
      });
      
      toast.show('Registration initialised! Verification OTP sent to your email.', 'success');
      setShowOTPVerification(true);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Registration failed';
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      return toast.show('Please enter the 6-digit verification code', 'error');
    }

    setLoading(true);
    try {
      const { verifyOTP } = useAuth.getState();
      const result = await verifyOTP(email.trim().toLowerCase(), otp.trim());
      if (result.success) {
        toast.show('Account verified! Welcome to FitPass!', 'success');
      } else {
        toast.show(result.message || 'Verification failed', 'error');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'OTP verification failed';
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                if (showOTPVerification) {
                  setShowOTPVerification(false);
                } else {
                  router.replace('/(auth)/login');
                }
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#4A3F35" />
            </TouchableOpacity>

            <View style={styles.headerContainer}>
              <Text style={styles.title}>{showOTPVerification ? 'VERIFY OTP' : 'FITPASS SIGNUP'}</Text>
              <Text style={styles.subtitle}>
                {showOTPVerification
                  ? `Enter the 6-digit verification code sent to ${email}`
                  : 'Join Zippy FitPass and get access to premier gyms.'}
              </Text>
            </View>

            <View style={styles.formContainer}>
              {!showOTPVerification ? (
                <>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#6E5E51" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      placeholderTextColor="#A19183"
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={20} color="#6E5E51" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email Address"
                      placeholderTextColor="#A19183"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!emailParam}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={20} color="#6E5E51" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Phone Number (10 Digits)"
                      placeholderTextColor="#A19183"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color="#6E5E51" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Create Password (min. 6 chars)"
                      placeholderTextColor="#A19183"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    <LinearGradient
                      colors={['#FF6B00', '#E04F00']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.primaryButtonText}>Register Account</Text>
                          <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="keypad-outline" size={20} color="#6E5E51" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit Code"
                      placeholderTextColor="#A19183"
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleVerifyOTP}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    <LinearGradient
                      colors={['#FF6B00', '#E04F00']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 36,
  },
  content: {
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 0,
    left: 24,
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F0EC',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E6E1DC',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 60,
  },
  title: {
    fontSize: 28,
    color: '#1C1611',
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6E5E51',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  formContainer: {
    gap: 18,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F1EC',
    borderRadius: 18,
    height: 60,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#E6E1DC',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#1C1611',
    fontSize: 16,
    fontWeight: '500',
  },
  primaryButton: {
    height: 60,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
});
