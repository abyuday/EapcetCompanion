import { Link } from 'react-router-dom';
import { 
  Rocket, BookOpen, Target, FileDown, 
  FileCheck, Network, MapPin, FlaskConical,
  Award, CreditCard, Calendar, UserCheck, Key, 
  ListPlus, Building, GraduationCap, ArrowRight
} from 'lucide-react';

const Homepage = () => {
  const cards = [
    {
      title: "College Preference List",
      desc: "Generate possible college and branch preference order using previous counselling trends.",
      icon: <Target />,
      link: "/preference-generator"
    },
    {
      title: "Counselling Guide",
      desc: "Step-by-step explanation of TG EAPCET counselling process.",
      icon: <BookOpen />,
      link: "/guide"
    },
    {
      title: "Mock Option Entry",
      desc: "Practice and understand how web options entry works.",
      icon: <FlaskConical />,
      link: "/mock-demo"
    },
    {
      title: "Download PDF & Excel",
      desc: "Download counselling preference lists and reports.",
      icon: <FileDown />,
      link: "/export"
    },
    {
      title: "Required Documents",
      desc: "View required certificates and verification documents.",
      icon: <FileCheck />,
      link: "/documents"
    },
    {
      title: "About Branches",
      desc: "Understand branches like CSE, AIML, ECE, DS and more.",
      icon: <Network />,
      link: "/branches"
    },
    {
      title: "Helpline Centres",
      desc: "View certificate verification centres and help line centres.",
      icon: <MapPin />,
      link: "/helpline-centres"
    }
  ];

  const timelineSteps = [
    { text: "EAPCET Result", icon: <Award size={18} /> },
    { text: "Processing Fee", icon: <CreditCard size={18} /> },
    { text: "Slot Booking", icon: <Calendar size={18} /> },
    { text: "Certificate Verification", icon: <UserCheck size={18} /> },
    { text: "Password Generation", icon: <Key size={18} /> },
    { text: "Web Options Entry", icon: <ListPlus size={18} /> },
    { text: "Seat Allotment", icon: <Award size={18} /> },
    { text: "Tuition Fee Payment", icon: <CreditCard size={18} /> },
    { text: "Self Reporting", icon: <UserCheck size={18} /> },
    { text: "College Joining", icon: <Building size={18} /> }
  ];

  return (
    <>
      <header>
        <div className="container">
          <Link to="/" className="logo">
            <GraduationCap size={28} color="#7c3aed" />
            EAPCET Companion
          </Link>
        </div>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="hero">
          <div className="container">
            <div className="hero-content fade-in-up">
              <h1 className="hero-title">
                EAPCET Counselling<br /><span>Made Simple</span>
              </h1>
              <p className="hero-subtitle">
                Explore counselling steps, generate college preference lists, understand branches, and experience the complete TG EAPCET counselling process visually.
              </p>
              <div className="hero-buttons">
                <Link to="/preference-generator" className="btn btn-primary">
                  <Rocket size={18} /> Start Exploring
                </Link>
                <Link to="/guide" className="btn btn-secondary">
                  <BookOpen size={18} /> Counselling Guide
                </Link>
              </div>

              {/* Mock UI Visual */}
              <div className="hero-visual">
                <div className="mock-ui">
                  <div className="mock-header"></div>
                  <div className="mock-card">
                    <div className="mock-circle"></div>
                    <div className="mock-line"></div>
                  </div>
                  <div className="mock-card" style={{opacity: 0.7}}>
                    <div className="mock-circle"></div>
                    <div className="mock-line" style={{width: '40%'}}></div>
                  </div>
                  <div className="mock-card" style={{opacity: 0.4}}>
                    <div className="mock-circle"></div>
                    <div className="mock-line" style={{width: '75%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7 FLOATING INTERACTIVE CARDS */}
        <section className="modules container">
          <div className="section-header fade-in-up">
            <h2 className="section-title">Explore Modules</h2>
            <p className="section-subtitle">Navigate through the simplest visual tools built to guide your counselling journey.</p>
          </div>
          <div className="grid-modules">
            {cards.map((card, index) => (
              <Link to={card.link} className="module-card fade-in-up" style={{ animationDelay: `${index * 50}ms` }} key={index}>
                <div className="module-icon">
                  {card.icon}
                </div>
                <h3 className="module-title">{card.title}</h3>
                <p className="module-desc">{card.desc}</p>
                <div style={{marginTop: 'auto', paddingTop: '1.5rem', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 500}}>
                  Explore <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* VISUAL COUNSELLING TIMELINE */}
        <section className="timeline-section">
          <div className="container">
            <div className="section-header fade-in-up">
              <h2 className="section-title">Counselling Timeline</h2>
              <p className="section-subtitle">A simple, step-by-step view of the entire process from results to joining.</p>
            </div>
            
            <div className="timeline-container">
              {timelineSteps.map((step, index) => (
                <div className="timeline-item fade-in-up" style={{animationDelay: `${(index % 5) * 100}ms`}} key={index}>
                  <div className="timeline-icon">
                    {step.icon}
                  </div>
                  <div className="timeline-content">
                    <h4 className="timeline-title">{step.text}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER & DISCLAIMER */}
      <footer>
        <div className="container">
          <div className="disclaimer-box fade-in-up">
            <p className="disclaimer-text">
              <strong>Disclaimer:</strong> This platform is created only for educational and counselling guidance purposes using official TG EAPCET resources and previous counselling trends. It does not guarantee allotments and is not an official counselling website.
            </p>
          </div>
          
          <div className="footer-content">
            <div className="footer-col">
              <h4>Quick Links</h4>
              <ul className="footer-links">
                <li><Link to="/">Home</Link></li>
                <li><Link to="/preference-generator">Preference Generator</Link></li>
                <li><Link to="/guide">Counselling Guide</Link></li>
                <li><Link to="/mock-demo">Mock Option Entry</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <ul className="footer-links">
                <li><Link to="/documents">Required Documents</Link></li>
                <li><Link to="/branches">About Branches</Link></li>
                <li><Link to="/helpline-centres">Helpline Centres</Link></li>
                <li><Link to="/export">Download PDF & Excel</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>About</h4>
              <ul className="footer-links">
                <li><Link to="#">Educational Purpose Note</Link></li>
                <li><Link to="#">References</Link></li>
                <li><Link to="#">Contact</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} EAPCET Counselling Companion. Created for student guidance.</p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default function App() {
  return <Homepage />;
}
