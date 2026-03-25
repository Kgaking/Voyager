import React, { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Search, MapPin, Calendar, ArrowRight, Menu, X, Compass, Globe, Star, LogIn, LogOut, Bookmark, User as UserIcon } from "lucide-react";
import { Destination, Itinerary } from "./types";
import { curateDestinations, generateItinerary } from "./lib/gemini";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, where, onSnapshot, serverTimestamp, deleteDoc } from "firebase/firestore";

// --- Auth Context ---

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Sync user profile to Firestore
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: "user",
            createdAt: serverTimestamp(),
          });
        }
      }
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

// --- Components ---

const Navbar = () => {
  const { user, signIn, logout } = useAuth();
  
  return (
    <nav className="fixed top-0 left-0 w-full z-50 px-8 py-6 flex justify-between items-center mix-blend-difference text-paper">
      <Link to="/" className="text-2xl font-serif tracking-tighter hover:opacity-70 transition-opacity">VOYAGER</Link>
      <div className="flex gap-8 items-center text-xs uppercase tracking-widest font-medium">
        <Link to="/curate" className="hover:opacity-70 transition-opacity">Curate</Link>
        {user ? (
          <div className="flex items-center gap-6">
            <Link to="/profile" className="hover:opacity-70 transition-opacity flex items-center gap-2">
              <UserIcon size={16} />
              Profile
            </Link>
            <button onClick={logout} className="hover:opacity-70 transition-opacity flex items-center gap-2">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        ) : (
          <button onClick={signIn} className="hover:opacity-70 transition-opacity flex items-center gap-2">
            <LogIn size={16} />
            Login
          </button>
        )}
        <button className="hover:opacity-70 transition-opacity"><Menu size={20} /></button>
      </div>
    </nav>
  );
};

const LandingPage = () => {
  const featured = [
    { id: "1", name: "Kyoto", country: "Japan", imageUrl: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=1000" },
    { id: "2", name: "Amalfi", country: "Italy", imageUrl: "https://images.unsplash.com/photo-1633321088355-d0f81134ca3b?auto=format&fit=crop&q=80&w=1000" },
    { id: "3", name: "Santorini", country: "Greece", imageUrl: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&q=80&w=1000" },
  ];

  return (
    <div className="min-h-screen pt-32 px-8 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-end mb-32">
        <motion.h1 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[12vw] leading-[0.85] tracking-tighter font-serif uppercase"
        >
          The Art of <br /> <span className="italic ml-[10vw]">Escape</span>
        </motion.h1>
        <div className="max-w-md">
          <p className="text-lg text-ink/70 leading-relaxed mb-8">
            Voyager is a premium editorial travel curator. We don't just plan trips; we craft narratives of discovery, tailored to your aesthetic and soul.
          </p>
          <Link to="/curate" className="inline-flex items-center gap-4 px-8 py-4 bg-ink text-paper rounded-full hover:bg-accent transition-colors group">
            <span className="uppercase text-xs tracking-widest font-medium">Start Your Journey</span>
            <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {featured.map((dest, i) => (
          <motion.div 
            key={dest.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group cursor-pointer"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl mb-4">
              <img 
                src={dest.imageUrl} 
                alt={dest.name} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
            </div>
            <h3 className="text-2xl font-serif">{dest.name}</h3>
            <p className="text-xs uppercase tracking-widest text-ink/50">{dest.country}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const CuratePage = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Destination[]>([]);
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setLoading(true);
    try {
      const data = await curateDestinations(query);
      setResults(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-32 px-8 pb-20">
      <div className="max-w-4xl mx-auto text-center mb-20">
        <h2 className="text-6xl font-serif mb-8 italic">Where does your soul <br /> want to wander?</h2>
        <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe your ideal vibe (e.g., 'Quiet mountain retreats with minimalist architecture')"
            className="w-full bg-transparent border-b border-ink/20 py-4 px-2 text-xl focus:outline-none focus:border-ink transition-colors placeholder:text-ink/30"
          />
          <button type="submit" className="absolute right-0 bottom-4 text-ink/50 hover:text-ink transition-colors">
            <Search size={24} />
          </button>
        </form>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Compass size={48} className="text-accent" />
          </motion.div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50 animate-pulse">Curating your narrative...</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {results.map((dest, i) => (
          <motion.div 
            key={dest.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="group cursor-pointer"
            onClick={() => navigate(`/destination/${dest.id}`, { state: { destination: dest } })}
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] mb-6 shadow-2xl shadow-ink/5">
              <img 
                src={dest.imageUrl} 
                alt={dest.name} 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-6 right-6 px-4 py-2 glass rounded-full text-[10px] uppercase tracking-widest font-bold text-paper">
                {dest.vibe}
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-3xl font-serif mb-1">{dest.name}</h3>
                <p className="text-xs uppercase tracking-widest text-ink/50">{dest.country}</p>
              </div>
              <div className="w-10 h-10 rounded-full border border-ink/10 flex items-center justify-center group-hover:bg-ink group-hover:text-paper transition-all">
                <ArrowRight size={16} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const DestinationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const state = window.history.state?.usr?.destination;
    if (state) {
      setDestination(state);
      handleGenerateItinerary(state);
    } else {
      navigate("/curate");
    }
  }, [id]);

  useEffect(() => {
    if (user && destination) {
      const destRef = doc(db, "users", user.uid, "destinations", destination.id);
      getDoc(destRef).then(docSnap => {
        if (docSnap.exists()) setIsSaved(true);
      });
    }
  }, [user, destination]);

  const handleGenerateItinerary = async (dest: Destination) => {
    setLoading(true);
    try {
      const data = await generateItinerary(dest);
      setItinerary(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      signIn();
      return;
    }
    if (!destination || !itinerary) return;

    setSaving(true);
    try {
      const destRef = doc(db, "users", user.uid, "destinations", destination.id);
      await setDoc(destRef, {
        ...destination,
        userId: user.uid,
        savedAt: serverTimestamp(),
      });

      const itineraryRef = doc(db, "users", user.uid, "itineraries", itinerary.id);
      await setDoc(itineraryRef, {
        ...itinerary,
        userId: user.uid,
        savedAt: serverTimestamp(),
      });

      setIsSaved(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/destinations`);
    } finally {
      setSaving(false);
    }
  };

  if (!destination) return null;

  return (
    <div className="min-h-screen bg-paper">
      <div className="h-[80vh] relative overflow-hidden">
        <img 
          src={destination.imageUrl} 
          alt={destination.name} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-transparent to-black/30" />
        <div className="absolute bottom-20 left-8 right-8 flex flex-col md:flex-row justify-between items-end gap-8">
          <div>
            <motion.p 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs uppercase tracking-[0.5em] text-ink/60 mb-4"
            >
              {destination.country}
            </motion.p>
            <motion.h1 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10vw] leading-none font-serif tracking-tighter"
            >
              {destination.name}
            </motion.h1>
          </div>
          <div className="max-w-md text-right">
            <p className="text-xl italic font-serif text-ink/80 mb-4">"{destination.vibe}"</p>
            <div className="flex gap-2 justify-end">
              {destination.highlights.map((h, i) => (
                <span key={i} className="text-[10px] uppercase tracking-widest px-3 py-1 border border-ink/20 rounded-full">
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-32 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-20">
          <div className="lg:col-span-1">
            <div className="sticky top-32">
              <h2 className="text-4xl font-serif mb-8">The Narrative</h2>
              <p className="text-lg text-ink/70 leading-relaxed mb-12">
                {destination.description}
              </p>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={handleSave}
                  disabled={saving || isSaved}
                  className={`flex items-center justify-center gap-4 px-8 py-4 rounded-full transition-all ${isSaved ? 'bg-accent/20 text-accent cursor-default' : 'bg-ink text-paper hover:bg-accent'}`}
                >
                  <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
                  <span className="uppercase text-xs tracking-widest font-medium">
                    {saving ? "Saving..." : isSaved ? "Saved to Profile" : "Save Journey"}
                  </span>
                </button>
                <div className="p-8 bg-accent/5 rounded-3xl border border-accent/10">
                  <h4 className="text-xs uppercase tracking-widest font-bold mb-4 flex items-center gap-2">
                    <Star size={14} className="text-accent" />
                    Voyager Curated
                  </h4>
                  <p className="text-sm italic text-ink/60">
                    This destination has been selected for its exceptional alignment with your aesthetic preferences. Every detail has been considered to ensure a transformative experience.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-4xl font-serif">Curated Itinerary</h2>
              {loading && <p className="text-xs uppercase tracking-widest animate-pulse text-accent">Generating details...</p>}
            </div>

            {itinerary && (
              <div className="space-y-20">
                {itinerary.days.map((day) => (
                  <div key={day.day} className="relative">
                    <div className="absolute -left-4 top-0 h-full w-px bg-ink/10" />
                    <div className="flex items-center gap-8 mb-12">
                      <div className="w-12 h-12 rounded-full bg-ink text-paper flex items-center justify-center font-serif text-xl z-10">
                        {day.day}
                      </div>
                      <h3 className="text-2xl font-serif uppercase tracking-widest">Day {day.day}</h3>
                    </div>
                    <div className="space-y-12 pl-12">
                      {day.items.map((item, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: 20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          className="group"
                        >
                          <p className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold mb-2">{item.time}</p>
                          <h4 className="text-2xl font-serif mb-2 group-hover:text-accent transition-colors">{item.activity}</h4>
                          <p className="text-xs uppercase tracking-widest text-ink/40 mb-4 flex items-center gap-2">
                            <MapPin size={12} /> {item.location}
                          </p>
                          <p className="text-ink/60 leading-relaxed max-w-xl">
                            {item.description}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfilePage = () => {
  const { user, loading: authLoading } = useAuth();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/");
    if (user) {
      const q = collection(db, "users", user.uid, "destinations");
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as Destination);
        setDestinations(data);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/destinations`);
      });
      return unsubscribe;
    }
  }, [user, authLoading]);

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Compass size={48} className="text-accent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen pt-32 px-8 pb-20 bg-paper">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-6xl font-serif mb-20">Your Curated <br /> <span className="italic ml-20">Journal</span></h1>
        
        {destinations.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-ink/10 rounded-[3rem]">
            <p className="text-ink/40 uppercase tracking-widest mb-8">No journeys saved yet</p>
            <Link to="/curate" className="text-accent hover:underline">Start Curating</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {destinations.map((dest) => (
              <div 
                key={dest.id}
                className="group cursor-pointer"
                onClick={() => navigate(`/destination/${dest.id}`, { state: { destination: dest } })}
              >
                <div className="relative aspect-square overflow-hidden rounded-[2rem] mb-6">
                  <img 
                    src={dest.imageUrl} 
                    alt={dest.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (user) {
                        await deleteDoc(doc(db, "users", user.uid, "destinations", dest.id));
                      }
                    }}
                    className="absolute top-6 right-6 w-10 h-10 glass rounded-full flex items-center justify-center text-paper opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                  >
                    <X size={16} />
                  </button>
                </div>
                <h3 className="text-3xl font-serif">{dest.name}</h3>
                <p className="text-xs uppercase tracking-widest text-ink/50">{dest.country}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="selection:bg-accent selection:text-paper">
          <Navbar />
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/curate" element={<CuratePage />} />
              <Route path="/destination/:id" element={<DestinationPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </AnimatePresence>
        </div>
      </Router>
    </AuthProvider>
  );
}
