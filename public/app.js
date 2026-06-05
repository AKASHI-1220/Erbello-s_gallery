(() => {
  'use strict';

  const VERSION = 'ERBELLO Gallery v29 more blog assets';
  const PREVIEW_MODE = document.body.dataset.preview === '1';
  const ownerModeRequested = new URLSearchParams(location.search).get('admin') === '1' || location.hash.includes('admin');
  const SCHEMES = ['black','white'];
  const COLORS = ['crimson','sky','lavender','yellowblue','cream','rose','ocean','aurora','mint','pixel'];
  const LANGS = ['ko','en','ja','zh'];
  const ROUTES = ['home','projects','posts','about','contact','privacy','terms'];
  const CATEGORIES = ['all', 'tool', 'game', 'daily', 'study', 'cooking', 'fandom', 'design', 'chart', 'experiment', 'other', 'secret'];
  const POST_ASSET_BASE = '/assets/illust/imagegen-assets/web/';
  const POST_ASSETS = [
    ['bunny-mascot.png','토끼 마스코트'], ['heart-gem.png','보석 하트'], ['bow-heart.png','리본 하트'], ['potion-charm.png','물약 참'], ['rose-bouquet.png','장미 꽃다발'], ['pink-candy.png','핑크 캔디'], ['gold-star.png','골드 스타'], ['cloud-soft.png','구름'],
    ['charm-garland.png','참 가랜드'], ['divider-pink-beads.png','핑크 비즈선'], ['divider-blue-stars.png','블루 별선'], ['divider-lace-heart.png','레이스 하트선'], ['divider-cloud-moon.png','구름 달선'], ['divider-floral-rose.png','장미 꽃선'],
    ['divider-solid-heart-pink.png','실선 하트'], ['divider-dotted-bow-heart.png','점선 리본하트'], ['divider-dashed-cloud-stars.png','대시 구름별'], ['divider-lace-rose-pearl.png','레이스 장미진주'], ['divider-checkered-heart-tape.png','체크 하트테이프'], ['divider-lavender-potion-gems.png','라벤더 물약선'],
    ['memo-card.png','메모 카드'], ['index-tabs.png','인덱스 탭'], ['index-tab-stack.png','인덱스 묶음'], ['index-bookmarks.png','북마크 인덱스'], ['index-memo-tab.png','메모 인덱스'],
    ['index-single-heart-pink.png','핑크 하트 인덱스'], ['index-single-star-blue.png','블루 스타 인덱스'], ['index-single-moon-lavender.png','라벤더 북마크'], ['index-single-bow-cream.png','크림 리본 인덱스'],
    ['daily-teacup.png','일상 찻잔'], ['daily-calendar.png','일상 달력'],
    ['study-book.png','공부 책'], ['study-pencil.png','공부 연필'], ['study-laptop.png','공부 노트북'],
    ['cooking-pot.png','요리 냄비'], ['cooking-cake.png','요리 케이크'], ['cooking-utensils.png','요리 도구'],
    ['game-controller.png','게임 컨트롤러'], ['game-dice.png','게임 주사위'],
    ['fandom-plush.png','굿즈 인형'], ['fandom-acrylic-stand.png','아크릴 스탠드'], ['fandom-ticket.png','티켓'], ['fandom-keychain.png','키링'], ['fandom-trading-card.png','포카'], ['fandom-rosette.png','로제트']
  ].map(([file, label]) => ({ file, label, src:`${POST_ASSET_BASE}${file}` }));
  const RANDOM_GAMSUNG_COVER = '__GAMSUNG_RANDOM__';
  const GAMSUNG_COVERS = ['1','3','4','5','6','7','8','9','10','11','12','13','14','15'].map(n => `/assets/illust/gamsung-${n}.webp`);
  const SITE_ORIGIN = 'https://erbello.vercel.app';
  const ZIP_MANIFEST_PREFIX = 'ERBELLO_ZIP_MANIFEST_V2\n';
  const STORAGE_SOURCE_PREFIX = 'ERBELLO_STORAGE_SOURCE_V1\n';
  const POST_SOURCE_CODE = '__ERBELLO_POST__';
  const POST_ATTACH_PREFIX = 'ERBELLO_POST_ATTACHMENTS_V1:';
  const POST_SUBCATEGORY_PREFIX = 'sub:';
  const ZIP_BROWSER_WARN_LIMIT = 200 * 1024 * 1024;
  const ZIP_ENTRY_LIMIT = 50 * 1024 * 1024;
  const INLINE_CODE_LIMIT = 900 * 1024;
  const gamsungSessionCovers = new Map();
  const SCHEME_META_COLORS = { black:'#050912', white:'#f8fafc' };
  const LOCALE = { ko:'ko-KR', en:'en-US', ja:'ja-JP', zh:'zh-CN' };
  const $ = (id) => document.getElementById(id);

  const safeStorage = {
    get(kind, key) { try { return (kind === 'session' ? sessionStorage : localStorage).getItem(key); } catch (_) { return null; } },
    set(kind, key, value) { try { (kind === 'session' ? sessionStorage : localStorage).setItem(key, value); } catch (_) {} },
    remove(kind, key) { try { (kind === 'session' ? sessionStorage : localStorage).removeItem(key); } catch (_) {} }
  };

  const COMMON = {
    colors: { crimson:'Crimson', sky:'Sky Blue', lavender:'Lavender', yellowblue:'Yellow Blue', cream:'Cream', rose:'Rose', ocean:'Ocean', aurora:'Aurora', mint:'Mint', pixel:'Pixel' }, schemes:{ black:'Black', white:'White' }
  };

  const I18N = {
    ko: {
      pageTitle:'프로젝트 갤러리 · ERBELLO', metaDescription:'ERBELLO라는 활동명으로 만든 개인 프로젝트 갤러리입니다.', brandAria:'ERBELLO 홈으로 이동', brandSubtitle:'Project Gallery', navAria:'주요 메뉴', navHome:'홈', navProjects:'프로젝트', navAbout:'소개', navContact:'연락처', navPrivacy:'개인정보처리방침', privacyEyebrow:'개인정보', privacyTitle:'개인정보처리방침', privacyBody:'이 사이트는 ERBELLO가 만든 프로젝트 갤러리 운영과 기본적인 사이트 이용을 위해 필요한 최소한의 정보만 사용합니다.', privacyCard1Title:'수집하는 정보', privacyCard1Text:'방문 기록, 조회수, 문의 링크 이용과 같이 사이트 운영에 필요한 기본 정보가 사용될 수 있습니다.', privacyCard2Title:'광고와 쿠키', privacyCard2Text:'Google AdSense가 광고 제공 및 통계 목적으로 쿠키를 사용할 수 있습니다.', privacyCard3Title:'문의', privacyCard3Text:'개인정보 관련 문의는 연락처 페이지의 링크를 통해 보낼 수 있습니다.',
      topControlsAria:'언어와 테마 설정', languageLabel:'언어', languageAria:'언어 선택', themeLabel:'테마', themeAria:'테마 선택', schemeLabel:'배경 계열', colorLabel:'포인트 컬러', schemeBlack:'Black', schemeWhite:'White', ownerLogin:'소유자 로그인', ownerLogout:'소유자 모드 종료', editPage:'페이지 편집', addProject:'프로젝트 추가',
      previewBadge:'미리보기', previewNotice:'이 파일은 디자인 확인용입니다. 실제 저장은 배포된 사이트에서 진행됩니다.', lastUpdate:'ARCHIVE', recentKicker:'최근', recentProjects:'최근 프로젝트', viewAllProjects:'전체 프로젝트 보기',
      sectionKicker:'프로젝트', galleryTitle:'프로젝트 갤러리', searchPlaceholder:'프로젝트 검색...', searchAria:'프로젝트 검색', filterAria:'카테고리 필터', viewerAria:'소유자 미리보기', viewerFrameTitle:'프로젝트 미리보기', ownerPreview:'소유자 미리보기', openProject:'프로젝트 열기', copyLink:'링크 복사', openNewTab:'새 탭 열기', edit:'수정', delete:'삭제', close:'닫기',
      cancel:'취소', login:'로그인', save:'저장', adminHint:'프로젝트 추가, 수정, 삭제는 소유자 모드에서만 가능합니다.', passwordLabel:'관리자 비밀번호', passwordPlaceholder:'Vercel에 설정한 ADMIN_PASSWORD',
      pageModalTitle:'페이지 내용 편집', pageLabel:'페이지', scriptLabel:'말풍선 문구', eyebrowLabel:'작은 제목', infoTitleLabel:'정보 박스 제목', pageTitleLabel:'큰 제목', bodyLabel:'본문', blocksLabel:'정보 항목', blockTextLabel:'내용', emailLabel:'이메일', linksLabel:'링크', linksPlaceholder:'GitHub | https://github.com/...\nInstagram | https://instagram.com/...', contactLinksTitle:'연락처 링크', contactLinkName:'표시 이름', contactLinkUrl:'링크 주소', contactAddLink:'링크 추가', contactRemoveLink:'삭제', contactLinkHint:'연락처 페이지에는 링크 주소가 있는 항목만 표시됩니다. 이름은 비워도 주소를 보고 자동으로 채워집니다.', contactEmpty:'아직 등록된 연락처 링크가 없습니다.', manageContactLinks:'연락처 링크 관리', adminStatsTitle:'소유자 통계', statProjects:'프로젝트', statViews:'전체 조회수', statTop:'최고 조회 프로젝트', noStats:'아직 통계가 없습니다.', pageEditHint:'현재 선택한 언어의 페이지 문구만 저장됩니다.', pageSaved:'페이지를 저장했습니다.', pageLoadError:'페이지 내용을 불러오지 못했습니다.', pageSaveError:'페이지 저장 중 오류가 발생했습니다.',
      artifactModalTitleAdd:'프로젝트 추가', artifactModalTitleEdit:'프로젝트 수정', titleLabel:'제목', titlePlaceholder:'예: 오늘의 타로', categoryLabel:'대표 분류', descriptionLabel:'설명', descriptionPlaceholder:'카드에 표시될 짧은 소개 문구', tagsLabel:'태그', tagsPlaceholder:'예: HTML, 도구, 타로', tagsHint:'카테고리는 하나만 고르고, 나머지 분류는 태그로 여러 개 붙일 수 있습니다.', zipProcessing:'ZIP 파일을 정리하는 중입니다...', zipLoaded:'ZIP 프로젝트를 불러왔습니다.', zipNoIndex:'ZIP 안에서 index.html을 찾지 못했습니다.', zipTooLarge:'ZIP 파일이 너무 큽니다. 작은 앱부터 올려주세요.', zipReaderError:'ZIP을 읽지 못했습니다. 다시 압축하거나 단일 HTML로 올려주세요.', detectZip:'ZIP 프로젝트로 감지했습니다.', formatLabel:'파일 형식', formatHtml:'HTML', formatJsx:'JSX', formatZip:'ZIP', tagsLabel:'태그', tagsPlaceholder:'예: HTML, 도구, 타로', tagHint:'대표 카테고리는 하나만 고르고, 추가 태그로 여러 분류를 같이 넣을 수 있습니다.', detailLabel:'상세 소개', detailPlaceholder:'프로젝트를 어떻게 쓰는지, 어떤 점을 볼 만한지 조금 더 적어주세요.', detailHint:'상세 소개는 카드 설명보다 긴 프로젝트 설명으로 사용할 수 있습니다.', coverLabel:'대표 커버 이미지', coverEmpty:'커버 이미지 없음', randomCover:'GAMSUNG 랜덤', randomCoverActive:'GAMSUNG 랜덤 커버를 사용합니다.', removeImage:'이미지 제거', galleryImagesLabel:'추가 이미지', clearGallery:'추가 이미지 비우기', imageProcessing:'이미지를 정리하는 중입니다...', imageLoaded:'이미지를 불러왔습니다.', imageTooLarge:'이미지 용량이 너무 큽니다. 더 작은 이미지를 사용해주세요.', updatedLabel:'년월', quickTags:'빠른 태그', zipLoading:'ZIP 파일을 읽는 중입니다...', zipDone:'ZIP 파일을 단일 HTML로 변환했습니다.', zipNoIndex:'ZIP 안에서 index.html을 찾지 못했습니다.', zipUnsupported:'ZIP 업로드 도구를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.', zipTooLarge:'ZIP 파일이 너무 큽니다. 이미지가 많은 경우 단일 HTML 변환 후 용량이 커질 수 있습니다.', dropText:'HTML, JSX, TSX, ZIP 파일을 이곳에 끌어다 놓거나 선택하세요.', codeLabel:'코드', codePlaceholder:'HTML 전체 코드 또는 React/JSX 코드를 붙여넣으세요.', detectWaiting:'감지 대기 중',
      emptyPublicTitle:'아직 공개된 프로젝트가 없습니다.', emptyPublicText:'곧 ERBELLO의 프로젝트가 이곳에 정리됩니다.', emptyOwnerTitle:'첫 프로젝트를 추가해보세요.', emptyOwnerText:'소유자 모드에서 HTML 또는 JSX 파일을 등록하면 카드가 만들어집니다.', emptyHomeTitle:'최근 프로젝트가 아직 없습니다.', emptyHomeText:'프로젝트를 추가하면 홈에도 최신 카드가 표시됩니다.',
      untitled:'제목 없음', noDescription:'설명이 없습니다.', noDate:'날짜 없음', views:'조회수', privateProject:'비밀 / 비밀번호 필요', privateProjectHint:'방문자에게는 제목만 보이고, 비밀번호를 입력해야 열립니다.', privatePasswordLabel:'비밀 프로젝트 비밀번호', privatePasswordPlaceholder:'비밀번호 입력', privatePasswordHint:'수정할 때 비워두면 기존 비밀번호가 유지됩니다.', lockedTag:'LOCKED', lockedDescription:'비밀번호가 필요한 프로젝트입니다.', privateBadge:'비밀', copied:'링크를 복사했습니다.', ownerOn:'소유자 모드가 켜졌습니다.', ownerOffMsg:'소유자 모드를 종료했습니다.', previewNoSave:'미리보기 파일에서는 저장되지 않습니다.', needPassword:'비밀번호를 입력해주세요.', notConfigured:'서버에 관리자 비밀번호가 설정되지 않았습니다.', wrongPassword:'비밀번호가 맞지 않습니다.', required:'제목과 코드를 입력해주세요.', saveError:'저장 중 오류가 발생했습니다.', loadError:'프로젝트를 불러오지 못했습니다.', confirmDelete:'정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.', saved:'저장했습니다.', deleted:'삭제했습니다.', fileLoaded:'파일을 불러왔습니다.', detectHtml:'HTML 프로젝트로 감지했습니다.', detectJsx:'React / JSX 프로젝트로 감지했습니다.',
      typeHtml:'HTML', typeReact:'React / JSX', typeGame:'게임', typeTool:'도구', typeDaily:'일상', typeDesign:'디자인', typeChart:'차트', typeExperiment:'실험', typeOther:'기타',
      categories:{ all:'전체', html:'Web App', react:'JSX', game:'게임', tool:'도구', daily:'일상', design:'디자인', chart:'차트', experiment:'실험', other:'기타' }, colors: COMMON.colors, schemes:{black:'Black', white:'White'},
      defaultPages: {
        home:{ script:'어서오세요!', eyebrow:'개인 프로젝트 갤러리', title:'ERBELLO | GALLERY', body:'작게나마 만든 프로젝트 갤러리입니다! 자유롭게 구경해주세요!', infoTitle:'ERBELLO.INFO', blocks:[{title:'개인 프로젝트 컬렉션', text:'작은 아이디어에서 시작된 다양한 프로젝트를 모았습니다.'},{title:'실험과 기록', text:'배우고, 만들고, 기록하는 과정을 공유합니다.'},{title:'지속적인 업데이트', text:'새로운 프로젝트가 꾸준히 추가됩니다.'}] },
        projects:{ eyebrow:'프로젝트', title:'프로젝트 갤러리', body:'카드를 열어 프로젝트를 확인하고 링크로 공유할 수 있습니다.', infoTitle:'', blocks:[] },
        about:{ eyebrow:'ABOUT', title:'ERBELLO 소개', body:'이 사이트는 ERBELLO라는 활동명으로 만든 HTML 페이지, React/JSX 아티팩트, 작은 게임과 도구를 모아두는 개인 프로젝트 갤러리입니다.', infoTitle:'ABOUT.INFO', blocks:[{title:'작게 시작한 프로젝트', text:'아이디어를 빠르게 만들고 실제로 열어볼 수 있는 형태로 보관합니다.'},{title:'보여주기 좋은 갤러리', text:'각 프로젝트를 카드로 정리해 방문자가 쉽게 둘러볼 수 있게 합니다.'},{title:'계속 바뀌는 저장소', text:'새로운 작업물이 생기면 천천히 업데이트됩니다.'}] },
        contact:{ eyebrow:'CONTACT', title:'연락처', body:'프로젝트 문의나 공유하고 싶은 이야기가 있다면 아래 링크를 이용해주세요.', infoTitle:'CONTACT.INFO', email:'', links:[], blocks:[] }
      },
      samples:[['sample-receipt','영수증 뽑기 🧾','간편하게 영수증을 생성하고 다운로드해 보세요!','tool'],['sample-tarot','오늘의 타로 🔮','오늘의 운세를 타로 카드로 확인해 보세요.','daily'],['sample-typing','타자 속도 측정기 ⚡','나의 타자 속도와 정확도를 측정해 보세요.','tool'],['sample-pudding','푸딩 게임 🎮','귀여운 푸딩을 모아 최고 점수에 도전하세요!','game'],['sample-note','Mini Note 📝','간단한 메모를 빠르게 작성하고 관리하세요.','daily'],['sample-box','Random Box 🎁','랜덤 박스를 열어 오늘의 행운을 만나보세요!','experiment'],['sample-night','Night Sky Diary ⭐','밤하늘의 감성과 생각을 기록하는 다이어리.','daily'],['sample-cherry','Cherry Blossom Timer 🌸','벚꽃이 흩날리는 집중 타이머로 생산성을 높여보세요.','tool'],['sample-ocean','Ocean Mood Board 🌊','바다의 분위기를 담은 무드보드 모음.','design']]
    },
    en: {
      pageTitle:'Project Gallery · ERBELLO', metaDescription:'A personal project gallery of works made under the activity name ERBELLO.', brandAria:'Go to ERBELLO home', brandSubtitle:'Project Gallery', navAria:'Primary navigation', navHome:'Home', navProjects:'Projects', navAbout:'About', navContact:'Contact', navPrivacy:'Privacy Policy', privacyEyebrow:'PRIVACY', privacyTitle:'Privacy Policy', privacyBody:'This site uses only the minimum information needed to run the project gallery made by ERBELLO and its basic features.', privacyCard1Title:'Information used', privacyCard1Text:'Basic operational data such as visit activity, view counts, and contact link usage may be used.', privacyCard2Title:'Ads and cookies', privacyCard2Text:'Google AdSense may use cookies for ad delivery and measurement.', privacyCard3Title:'Contact', privacyCard3Text:'For privacy questions, use the links on the contact page.', topControlsAria:'Language and theme settings', languageLabel:'Language', languageAria:'Choose language', themeLabel:'Theme', themeAria:'Choose theme', schemeLabel:'Background', colorLabel:'Accent color', schemeBlack:'Black', schemeWhite:'White', ownerLogin:'Owner Login', ownerLogout:'Exit Owner Mode', editPage:'Edit Page', addProject:'Add Project', previewBadge:'Preview', previewNotice:'This file is for design preview. Saving works on the deployed site.', lastUpdate:'ARCHIVE', recentKicker:'Recent', recentProjects:'Recent Projects', viewAllProjects:'View All Projects', sectionKicker:'Projects', galleryTitle:'Project Gallery', searchPlaceholder:'Search projects...', searchAria:'Search projects', filterAria:'Category filter', viewerAria:'Owner preview', viewerFrameTitle:'Project preview', ownerPreview:'Owner Preview', openProject:'Open project', copyLink:'Copy Link', openNewTab:'Open New Tab', edit:'Edit', delete:'Delete', close:'Close', cancel:'Cancel', login:'Log in', save:'Save', adminHint:'Adding, editing and deleting projects is available only in owner mode.', passwordLabel:'Admin password', passwordPlaceholder:'ADMIN_PASSWORD set in Vercel', pageModalTitle:'Edit Page Content', pageLabel:'Page', scriptLabel:'Speech bubble text', eyebrowLabel:'Small title', infoTitleLabel:'Info box title', pageTitleLabel:'Main title', bodyLabel:'Body', blocksLabel:'Info Items', blockTextLabel:'Text', emailLabel:'Email', linksLabel:'Links', linksPlaceholder:'GitHub | https://github.com/...\nInstagram | https://instagram.com/...', contactLinksTitle:'Contact Links', contactLinkName:'Display name', contactLinkUrl:'Link URL', contactAddLink:'Add Link', contactRemoveLink:'Remove', contactLinkHint:'Only items with a URL appear on the contact page. If the name is blank, it will be filled from the URL.', contactEmpty:'No contact links have been added yet.', manageContactLinks:'Manage Contact Links', adminStatsTitle:'Owner Stats', statProjects:'Projects', statViews:'Total Views', statTop:'Top Project', noStats:'No stats yet.', pageEditHint:'Only the selected language content will be saved.', pageSaved:'Page saved.', pageLoadError:'Could not load page content.', pageSaveError:'Could not save page content.', artifactModalTitleAdd:'Add Project', artifactModalTitleEdit:'Edit Project', titleLabel:'Title', titlePlaceholder:'Example: Daily Tarot', categoryLabel:'Main Category', descriptionLabel:'Description', descriptionPlaceholder:'Short intro shown on the card', tagsLabel:'Tags', tagsPlaceholder:'Example: HTML, tool, tarot', tagsHint:'Choose one main category, then add multiple tags for the rest.', zipProcessing:'Preparing ZIP project...', zipLoaded:'ZIP project loaded.', zipNoIndex:'Could not find index.html inside the ZIP.', zipTooLarge:'This ZIP is too large. Please try a smaller project first.', zipReaderError:'Could not read the ZIP. Try zipping again or upload a single HTML file.', detectZip:'Detected as a ZIP project.', formatLabel:'File format', formatHtml:'HTML', formatJsx:'JSX', formatZip:'ZIP', tagsLabel:'Tags', tagsPlaceholder:'Example: HTML, tool, tarot', tagHint:'Choose one primary category, then add extra tags to show a project in multiple groups.', detailLabel:'Project details', detailPlaceholder:'Add a longer note about how to use the project or what to look at.', detailHint:'Project details can be used as a longer description than the card text.', coverLabel:'Cover image', coverEmpty:'No cover image', randomCover:'Random GAMSUNG', randomCoverActive:'Using a random GAMSUNG cover.', removeImage:'Remove image', galleryImagesLabel:'Extra images', clearGallery:'Clear extra images', imageProcessing:'Preparing image...', imageLoaded:'Image loaded.', imageTooLarge:'The image is too large. Please use a smaller image.', updatedLabel:'Month', quickTags:'Quick tags', zipLoading:'Reading ZIP file...', zipDone:'Converted the ZIP into a single HTML file.', zipNoIndex:'Could not find index.html inside the ZIP.', zipUnsupported:'Could not load the ZIP upload tool. Please try again later.', zipTooLarge:'The ZIP file is too large. Image-heavy ZIPs can become large after conversion.', dropText:'Drag an HTML, JSX, TSX or ZIP file here, or choose one.', codeLabel:'Code', codePlaceholder:'Paste a full HTML document or React/JSX code.', detectWaiting:'Waiting for detection', emptyPublicTitle:'No public projects yet.', emptyPublicText:'ERBELLO projects will appear here soon.', emptyOwnerTitle:'Add your first project.', emptyOwnerText:'Upload an HTML or JSX file in owner mode to create a card.', emptyHomeTitle:'No recent projects yet.', emptyHomeText:'When projects are added, recent cards will appear on the home page.', untitled:'Untitled', noDescription:'No description.', noDate:'No date', views:'Views', privateProject:'Private / password required', privateProjectHint:'Visitors see only the title until they enter the password.', privatePasswordLabel:'Private project password', privatePasswordPlaceholder:'Enter password', privatePasswordHint:'When editing, leave this blank to keep the current password.', lockedTag:'LOCKED', lockedDescription:'This project requires a password.', privateBadge:'Private', copied:'Link copied.', ownerOn:'Owner mode is on.', ownerOffMsg:'Owner mode has ended.', previewNoSave:'Preview files do not save changes.', needPassword:'Please enter the password.', notConfigured:'Admin password is not configured on the server.', wrongPassword:'Wrong password.', required:'Please enter a title and code.', saveError:'An error occurred while saving.', loadError:'Could not load projects.', confirmDelete:'Delete this project? This cannot be undone.', saved:'Saved.', deleted:'Deleted.', fileLoaded:'File loaded.', detectHtml:'Detected as an HTML project.', detectJsx:'Detected as a React / JSX project.', typeHtml:'HTML', typeReact:'React / JSX', typeGame:'Game', typeTool:'Tool', typeDaily:'Daily', typeDesign:'Design', typeChart:'Chart', typeExperiment:'Experiment', typeOther:'Other', categories:{all:'All', html:'Web App', react:'JSX', game:'Game', tool:'Tool', daily:'Daily', design:'Design', chart:'Chart', experiment:'Experiment', other:'Other'}, colors:COMMON.colors, schemes:COMMON.schemes,
      defaultPages:{ home:{script:'Welcome!', eyebrow:'Personal Project Gallery', title:'ERBELLO | GALLERY', body:'A small project gallery. Feel free to look around!', infoTitle:'ERBELLO.INFO', blocks:[{title:'Personal Project Collection', text:'A collection of projects that started from small ideas.'},{title:'Experiments and Records', text:'Sharing the process of learning, making and recording.'},{title:'Continuous Updates', text:'New projects are added little by little.'}]}, projects:{eyebrow:'Projects', title:'Project Gallery', body:'Open a card to view a project, or copy a link to share it.', infoTitle:'', blocks:[]}, about:{eyebrow:'ABOUT', title:'About ERBELLO', body:'This site collects completed HTML pages, React/JSX artifacts, small games, and tools made under the activity name ERBELLO.', infoTitle:'ABOUT.INFO', blocks:[{title:'Small Projects', text:'Ideas are stored in a form that can be opened and shared.'},{title:'Gallery for Viewing', text:'Projects are organized as cards so visitors can browse them easily.'},{title:'A Growing Archive', text:'New work is added gradually as it is made.'}]}, contact:{eyebrow:'CONTACT', title:'Contact', body:'Use the links below for project questions or messages.', infoTitle:'CONTACT.INFO', email:'', links:[], blocks:[]} },
      samples:[['sample-receipt','Receipt Maker 🧾','Create a simple receipt and download it.','tool'],['sample-tarot','Daily Tarot 🔮','Check today’s mood with tarot cards.','daily'],['sample-typing','Typing Speed Test ⚡','Measure typing speed and accuracy.','tool'],['sample-pudding','Pudding Game 🎮','Collect cute pudding and aim for a high score.','game'],['sample-note','Mini Note 📝','Write and manage quick notes.','daily'],['sample-box','Random Box 🎁','Open a random box and meet today’s luck.','experiment'],['sample-night','Night Sky Diary ⭐','A diary for night-sky moods and thoughts.','daily'],['sample-cherry','Cherry Blossom Timer 🌸','A focus timer with falling cherry blossoms.','tool'],['sample-ocean','Ocean Mood Board 🌊','A mood board filled with ocean atmosphere.','design']]
    },
    ja: {
      pageTitle:'プロジェクトギャラリー · ERBELLO', metaDescription:'ERBELLOという活動名で制作した個人プロジェクトギャラリーです。', brandAria:'ERBELLOホームへ移動', brandSubtitle:'Project Gallery', navAria:'メインメニュー', navHome:'ホーム', navProjects:'プロジェクト', navAbout:'紹介', navContact:'連絡先', navPrivacy:'プライバシーポリシー', privacyEyebrow:'PRIVACY', privacyTitle:'プライバシーポリシー', privacyBody:'このサイトは、ERBELLOが制作したプロジェクトギャラリーの運営と基本機能のために必要最小限の情報を使用します。', privacyCard1Title:'使用する情報', privacyCard1Text:'訪問記録、閲覧数、連絡先リンク利用など、運営に必要な基本情報が使われる場合があります。', privacyCard2Title:'広告とCookie', privacyCard2Text:'Google AdSenseが広告配信と測定のためにCookieを使用する場合があります。', privacyCard3Title:'お問い合わせ', privacyCard3Text:'個人情報に関するお問い合わせは連絡先ページのリンクをご利用ください。', topControlsAria:'言語とテーマ設定', languageLabel:'言語', languageAria:'言語を選択', themeLabel:'テーマ', themeAria:'テーマを選択', schemeLabel:'背景', colorLabel:'アクセントカラー', schemeBlack:'Black', schemeWhite:'White', ownerLogin:'オーナーログイン', ownerLogout:'オーナーモード終了', editPage:'ページ編集', addProject:'プロジェクト追加', previewBadge:'プレビュー', previewNotice:'このファイルはデザイン確認用です。保存は公開サイトで行われます。', lastUpdate:'ARCHIVE', recentKicker:'最近', recentProjects:'最近のプロジェクト', viewAllProjects:'すべて見る', sectionKicker:'プロジェクト', galleryTitle:'プロジェクトギャラリー', searchPlaceholder:'プロジェクト検索...', searchAria:'プロジェクト検索', filterAria:'カテゴリー絞り込み', viewerAria:'オーナープレビュー', viewerFrameTitle:'プロジェクトプレビュー', ownerPreview:'オーナープレビュー', openProject:'開く', copyLink:'リンクコピー', openNewTab:'新しいタブで開く', edit:'編集', delete:'削除', close:'閉じる', cancel:'キャンセル', login:'ログイン', save:'保存', adminHint:'追加・編集・削除はオーナーモードでのみ利用できます。', passwordLabel:'管理者パスワード', passwordPlaceholder:'Vercelで設定したADMIN_PASSWORD', pageModalTitle:'ページ内容編集', pageLabel:'ページ', scriptLabel:'吹き出し文', eyebrowLabel:'小見出し', infoTitleLabel:'情報ボックス名', pageTitleLabel:'大見出し', bodyLabel:'本文', blocksLabel:'情報項目', blockTextLabel:'内容', emailLabel:'メール', linksLabel:'リンク', linksPlaceholder:'GitHub | https://github.com/...\nInstagram | https://instagram.com/...', contactLinksTitle:'連絡先リンク', contactLinkName:'表示名', contactLinkUrl:'リンクURL', contactAddLink:'リンク追加', contactRemoveLink:'削除', contactLinkHint:'連絡先ページにはURLがある項目だけ表示されます。名前が空の場合はURLから自動入力されます。', contactEmpty:'連絡先リンクはまだ登録されていません。', manageContactLinks:'連絡先リンク管理', adminStatsTitle:'オーナー統計', statProjects:'プロジェクト', statViews:'総閲覧数', statTop:'最多閲覧プロジェクト', noStats:'まだ統計がありません。', pageEditHint:'選択した言語のページ文言だけ保存されます。', pageSaved:'ページを保存しました。', pageLoadError:'ページ内容を読み込めませんでした。', pageSaveError:'ページ保存中にエラーが発生しました。', artifactModalTitleAdd:'プロジェクト追加', artifactModalTitleEdit:'プロジェクト編集', titleLabel:'タイトル', titlePlaceholder:'例：今日のタロット', categoryLabel:'代表カテゴリー', descriptionLabel:'説明', descriptionPlaceholder:'カードに表示する短い紹介文', tagsLabel:'タグ', tagsPlaceholder:'例：HTML、ツール、タロット', tagsHint:'メインカテゴリーは1つ選び、他の分類はタグで複数追加できます。', zipProcessing:'ZIPファイルを準備しています...', zipLoaded:'ZIPプロジェクトを読み込みました。', zipNoIndex:'ZIP内にindex.htmlが見つかりません。', zipTooLarge:'ZIPファイルが大きすぎます。まずは小さなプロジェクトを試してください。', zipReaderError:'ZIPを読み込めませんでした。再圧縮するか単一HTMLでアップロードしてください。', detectZip:'ZIPプロジェクトとして検出しました。', formatLabel:'ファイル形式', formatHtml:'HTML', formatJsx:'JSX', formatZip:'ZIP', tagsLabel:'タグ', tagsPlaceholder:'例：HTML、ツール、タロット', tagHint:'代表カテゴリーを1つ選び、追加タグで複数の分類に表示できます。', detailLabel:'詳細紹介', detailPlaceholder:'使い方や見どころを少し詳しく書いてください。', detailHint:'詳細紹介はカード説明より長いプロジェクト説明として使えます。', coverLabel:'カバー画像', coverEmpty:'カバー画像なし', randomCover:'GAMSUNGランダム', randomCoverActive:'GAMSUNGランダムカバーを使用します。', removeImage:'画像を削除', galleryImagesLabel:'追加画像', clearGallery:'追加画像を空にする', imageProcessing:'画像を処理中...', imageLoaded:'画像を読み込みました。', imageTooLarge:'画像が大きすぎます。小さい画像を使用してください。', updatedLabel:'年月', quickTags:'クイックタグ', zipLoading:'ZIPファイルを読み込んでいます...', zipDone:'ZIPを単一HTMLに変換しました。', zipNoIndex:'ZIP内にindex.htmlが見つかりません。', zipUnsupported:'ZIPアップロードツールを読み込めませんでした。しばらくしてから再度お試しください。', zipTooLarge:'ZIPファイルが大きすぎます。画像が多い場合、変換後のHTMLが大きくなることがあります。', dropText:'HTML、JSX、TSX、ZIPファイルをここにドラッグするか選択してください。', codeLabel:'コード', codePlaceholder:'HTML全文またはReact/JSXコードを貼り付けてください。', detectWaiting:'検出待ち', emptyPublicTitle:'まだ公開プロジェクトはありません。', emptyPublicText:'まもなくここにERBELLOのプロジェクトが並びます。', emptyOwnerTitle:'最初のプロジェクトを追加しましょう。', emptyOwnerText:'オーナーモードでHTMLまたはJSXを登録するとカードが作成されます。', emptyHomeTitle:'最近のプロジェクトはまだありません。', emptyHomeText:'プロジェクトを追加するとホームに最新カードが表示されます。', untitled:'無題', noDescription:'説明はありません。', noDate:'日付なし', views:'閲覧数', privateProject:'非公開 / パスワード必須', privateProjectHint:'訪問者にはタイトルだけ表示され、開くにはパスワードが必要です。', privatePasswordLabel:'非公開プロジェクトのパスワード', privatePasswordPlaceholder:'パスワードを入力', privatePasswordHint:'編集時は空欄のままにすると現在のパスワードを維持します。', lockedTag:'LOCKED', lockedDescription:'このプロジェクトはパスワードが必要です。', privateBadge:'非公開', copied:'リンクをコピーしました。', ownerOn:'オーナーモードがオンになりました。', ownerOffMsg:'オーナーモードを終了しました。', previewNoSave:'プレビューファイルでは保存されません。', needPassword:'パスワードを入力してください。', notConfigured:'サーバーに管理者パスワードが設定されていません。', wrongPassword:'パスワードが正しくありません。', required:'タイトルとコードを入力してください。', saveError:'保存中にエラーが発生しました。', loadError:'プロジェクトを読み込めませんでした。', confirmDelete:'本当に削除しますか？この操作は元に戻せません。', saved:'保存しました。', deleted:'削除しました。', fileLoaded:'ファイルを読み込みました。', detectHtml:'HTMLプロジェクトとして検出しました。', detectJsx:'React / JSXプロジェクトとして検出しました。', typeHtml:'HTML', typeReact:'React / JSX', typeGame:'ゲーム', typeTool:'ツール', typeDaily:'日常', typeDesign:'デザイン', typeChart:'チャート', typeExperiment:'実験', typeOther:'その他', categories:{all:'すべて', html:'Web App', react:'JSX', game:'ゲーム', tool:'ツール', daily:'日常', design:'デザイン', chart:'チャート', experiment:'実験', other:'その他'}, colors:COMMON.colors, schemes:{black:'Black', white:'White'},
      defaultPages:{ home:{script:'ようこそ！', eyebrow:'個人プロジェクトギャラリー', title:'ERBELLO | GALLERY', body:'小さく作ったプロジェクトギャラリーです！自由にご覧ください。', infoTitle:'ERBELLO.INFO', blocks:[{title:'個人プロジェクトコレクション', text:'小さなアイデアから始まったさまざまなプロジェクトを集めました。'},{title:'実験と記録', text:'学び、作り、記録する過程を共有します。'},{title:'継続的な更新', text:'新しいプロジェクトが少しずつ追加されます。'}]}, projects:{eyebrow:'プロジェクト', title:'プロジェクトギャラリー', body:'カードを開いてプロジェクトを確認し、リンクで共有できます。', infoTitle:'', blocks:[]}, about:{eyebrow:'ABOUT', title:'ERBELLOについて', body:'このサイトは、ERBELLOという活動名で制作したHTMLページ、React/JSXアーティファクト、小さなゲームやツールをまとめる個人プロジェクトギャラリーです。', infoTitle:'ABOUT.INFO', blocks:[{title:'小さく始めたプロジェクト', text:'アイデアを開いて共有できる形で保存します。'},{title:'見せやすいギャラリー', text:'プロジェクトをカードで整理し、訪問者が見やすいようにします。'},{title:'育っていく保存庫', text:'新しい作品ができるたびに少しずつ更新されます。'}]}, contact:{eyebrow:'CONTACT', title:'連絡先', body:'プロジェクトのお問い合わせやメッセージは下のリンクをご利用ください。', infoTitle:'CONTACT.INFO', email:'', links:[], blocks:[]} },
      samples:[['sample-receipt','レシート作成 🧾','シンプルなレシートを作成して保存できます。','tool'],['sample-tarot','今日のタロット 🔮','今日の気分をタロットカードで確認できます。','daily'],['sample-typing','タイピング速度測定 ⚡','タイピング速度と正確さを測定します。','tool'],['sample-pudding','プリンゲーム 🎮','かわいいプリンを集めて高得点を目指します。','game'],['sample-note','Mini Note 📝','小さなメモをすばやく管理できます。','daily'],['sample-box','Random Box 🎁','ランダムボックスで今日の運を開けます。','experiment'],['sample-night','Night Sky Diary ⭐','夜空の気分を記録する日記。','daily'],['sample-cherry','Cherry Blossom Timer 🌸','桜が舞う集中タイマーです。','tool'],['sample-ocean','Ocean Mood Board 🌊','海の雰囲気を集めたムードボード。','design']]
    },
    zh: {
      pageTitle:'项目画廊 · ERBELLO', metaDescription:'这是以 ERBELLO 这一活动名制作的个人项目画廊。', brandAria:'前往 ERBELLO 首页', brandSubtitle:'Project Gallery', navAria:'主导航', navHome:'首页', navProjects:'项目', navAbout:'介绍', navContact:'联系', navPrivacy:'隐私政策', privacyEyebrow:'PRIVACY', privacyTitle:'隐私政策', privacyBody:'本网站仅使用运行 ERBELLO 制作的项目画廊和基本网站功能所需的最少信息。', privacyCard1Title:'使用的信息', privacyCard1Text:'可能使用访问记录、浏览量、联系链接使用等运营所需的基本信息。', privacyCard2Title:'广告和 Cookie', privacyCard2Text:'Google AdSense 可能会使用 Cookie 用于广告投放和统计。', privacyCard3Title:'联系', privacyCard3Text:'有关隐私的问题，可通过联系页面的链接发送。', topControlsAria:'语言和主题设置', languageLabel:'语言', languageAria:'选择语言', themeLabel:'主题', themeAria:'选择主题', schemeLabel:'背景', colorLabel:'强调色', schemeBlack:'Black', schemeWhite:'White', ownerLogin:'所有者登录', ownerLogout:'退出所有者模式', editPage:'编辑页面', addProject:'添加项目', previewBadge:'预览', previewNotice:'此文件仅用于设计预览。保存功能请在已部署的网站中使用。', lastUpdate:'ARCHIVE', recentKicker:'最近', recentProjects:'最近项目', viewAllProjects:'查看全部项目', sectionKicker:'项目', galleryTitle:'项目画廊', searchPlaceholder:'搜索项目...', searchAria:'搜索项目', filterAria:'分类筛选', viewerAria:'所有者预览', viewerFrameTitle:'项目预览', ownerPreview:'所有者预览', openProject:'打开', copyLink:'复制链接', openNewTab:'在新标签页打开', edit:'编辑', delete:'删除', close:'关闭', cancel:'取消', login:'登录', save:'保存', adminHint:'添加、编辑和删除项目仅限所有者模式使用。', passwordLabel:'管理员密码', passwordPlaceholder:'在 Vercel 中设置的 ADMIN_PASSWORD', pageModalTitle:'编辑页面内容', pageLabel:'页面', scriptLabel:'气泡文字', eyebrowLabel:'小标题', infoTitleLabel:'信息框标题', pageTitleLabel:'大标题', bodyLabel:'正文', blocksLabel:'信息项目', blockTextLabel:'内容', emailLabel:'邮箱', linksLabel:'链接', linksPlaceholder:'GitHub | https://github.com/...\nInstagram | https://instagram.com/...', contactLinksTitle:'联系方式链接', contactLinkName:'显示名称', contactLinkUrl:'链接地址', contactAddLink:'添加链接', contactRemoveLink:'删除', contactLinkHint:'联系页只显示带有链接地址的项目。名称为空时会根据链接自动填写。', contactEmpty:'尚未添加联系方式链接。', manageContactLinks:'管理联系方式链接', adminStatsTitle:'所有者统计', statProjects:'项目', statViews:'总浏览量', statTop:'最高浏览项目', noStats:'暂无统计。', pageEditHint:'只会保存当前选择语言的页面文案。', pageSaved:'页面已保存。', pageLoadError:'无法加载页面内容。', pageSaveError:'保存页面时发生错误。', artifactModalTitleAdd:'添加项目', artifactModalTitleEdit:'编辑项目', titleLabel:'标题', titlePlaceholder:'例如：今日塔罗', categoryLabel:'主分类', descriptionLabel:'说明', descriptionPlaceholder:'显示在卡片上的简短介绍', tagsLabel:'标签', tagsPlaceholder:'例如：HTML、工具、塔罗', tagsHint:'主分类只选一个，其余分类可以作为多个标签添加。', zipProcessing:'正在整理 ZIP 项目...', zipLoaded:'ZIP 项目已读取。', zipNoIndex:'ZIP 中找不到 index.html。', zipTooLarge:'ZIP 文件太大。请先尝试较小的项目。', zipReaderError:'无法读取 ZIP。请重新压缩或上传单个 HTML 文件。', detectZip:'检测为 ZIP 项目。', formatLabel:'文件格式', formatHtml:'HTML', formatJsx:'JSX', formatZip:'ZIP', tagsLabel:'标签', tagsPlaceholder:'例如：HTML、工具、塔罗', tagHint:'选择一个主分类，再用标签让项目出现在多个分类中。', detailLabel:'详细介绍', detailPlaceholder:'写下项目的使用方式或值得看的地方。', detailHint:'详细介绍可作为比卡片说明更长的项目说明。', coverLabel:'封面图片', coverEmpty:'暂无封面图片', randomCover:'GAMSUNG 随机', randomCoverActive:'已使用 GAMSUNG 随机封面。', removeImage:'移除图片', galleryImagesLabel:'更多图片', clearGallery:'清空更多图片', imageProcessing:'正在处理图片...', imageLoaded:'图片已读取。', imageTooLarge:'图片太大。请使用更小的图片。', updatedLabel:'年月', quickTags:'快速标签', zipLoading:'正在读取 ZIP 文件...', zipDone:'已将 ZIP 转换为单个 HTML 文件。', zipNoIndex:'在 ZIP 中找不到 index.html。', zipUnsupported:'无法加载 ZIP 上传工具。请稍后重试。', zipTooLarge:'ZIP 文件太大。包含大量图片时，转换后的 HTML 可能会变大。', dropText:'将 HTML、JSX、TSX 或 ZIP 文件拖到这里，或选择文件。', codeLabel:'代码', codePlaceholder:'粘贴完整 HTML 文档或 React/JSX 代码。', detectWaiting:'等待检测', emptyPublicTitle:'还没有公开项目。', emptyPublicText:'ERBELLO 的项目很快会整理在这里。', emptyOwnerTitle:'添加第一个项目吧。', emptyOwnerText:'在所有者模式中上传 HTML 或 JSX 文件后，这里会生成项目卡片。', emptyHomeTitle:'还没有最近项目。', emptyHomeText:'添加项目后，首页会显示最新卡片。', untitled:'未命名', noDescription:'暂无说明。', noDate:'无日期', views:'浏览量', privateProject:'私密 / 需要密码', privateProjectHint:'访客只能看到标题，输入密码后才能打开。', privatePasswordLabel:'私密项目密码', privatePasswordPlaceholder:'输入密码', privatePasswordHint:'编辑时留空将保留当前密码。', lockedTag:'LOCKED', lockedDescription:'此项目需要密码。', privateBadge:'私密', copied:'链接已复制。', ownerOn:'所有者模式已开启。', ownerOffMsg:'所有者模式已关闭。', previewNoSave:'预览文件不会保存更改。', needPassword:'请输入密码。', notConfigured:'服务器尚未设置管理员密码。', wrongPassword:'密码不正确。', required:'请输入标题和代码。', saveError:'保存时发生错误。', loadError:'无法加载项目。', confirmDelete:'确定要删除吗？此操作无法撤销。', saved:'已保存。', deleted:'已删除。', fileLoaded:'文件已读取。', detectHtml:'检测为 HTML 项目。', detectJsx:'检测为 React / JSX 项目。', typeHtml:'HTML', typeReact:'React / JSX', typeGame:'游戏', typeTool:'工具', typeDaily:'日常', typeDesign:'设计', typeChart:'图表', typeExperiment:'实验', typeOther:'其他', categories:{all:'全部', html:'Web App', react:'JSX', game:'游戏', tool:'工具', daily:'日常', design:'设计', chart:'图表', experiment:'实验', other:'其他'}, colors:COMMON.colors, schemes:{black:'Black', white:'White'},
      defaultPages:{ home:{script:'欢迎！', eyebrow:'个人项目画廊', title:'ERBELLO | GALLERY', body:'这是一个小小的项目画廊！欢迎自由参观。', infoTitle:'ERBELLO.INFO', blocks:[{title:'个人项目合集', text:'这里收集了从小想法开始的各种项目。'},{title:'实验与记录', text:'分享学习、制作和记录的过程。'},{title:'持续更新', text:'新的项目会慢慢添加进来。'}]}, projects:{eyebrow:'项目', title:'项目画廊', body:'打开卡片即可查看项目，也可以复制链接直接分享。', infoTitle:'', blocks:[]}, about:{eyebrow:'ABOUT', title:'关于 ERBELLO', body:'本网站用于整理以 ERBELLO 这一活动名制作的 HTML 页面、React/JSX 作品、小型游戏和工具。', infoTitle:'ABOUT.INFO', blocks:[{title:'从小项目开始', text:'把想法保存成可以打开和分享的形式。'},{title:'适合展示的画廊', text:'用卡片整理项目，让访客更容易浏览。'},{title:'持续成长的收藏库', text:'新的作品会随着制作慢慢更新。'}]}, contact:{eyebrow:'CONTACT', title:'联系', body:'如有项目问题或想分享的信息，请使用下面的链接。', infoTitle:'CONTACT.INFO', email:'', links:[], blocks:[]} },
      samples:[['sample-receipt','收据生成器 🧾','轻松生成小收据并下载。','tool'],['sample-tarot','今日塔罗 🔮','用塔罗卡看看今天的心情。','daily'],['sample-typing','打字速度测试 ⚡','测量你的打字速度和准确度。','tool'],['sample-pudding','布丁游戏 🎮','收集可爱的布丁，挑战高分。','game'],['sample-note','Mini Note 📝','快速记录和整理简短备忘。','daily'],['sample-box','Random Box 🎁','打开随机盒子，遇见今天的好运。','experiment'],['sample-night','Night Sky Diary ⭐','记录夜空心情与想法的日记。','daily'],['sample-cherry','Cherry Blossom Timer 🌸','樱花飘落的专注计时器。','tool'],['sample-ocean','Ocean Mood Board 🌊','收藏海边氛围的灵感板。','design']]
    }
  };

  const CATEGORY_LABEL_PATCH = {
    ko:{ study:'공부', cooking:'요리', fandom:'덕질' },
    en:{ study:'Study', cooking:'Cooking', fandom:'Fandom' },
    ja:{ study:'勉強', cooking:'料理', fandom:'推し活' },
    zh:{ study:'学习', cooking:'料理', fandom:'追星' }
  };
  Object.keys(CATEGORY_LABEL_PATCH).forEach((lang) => {
    if (I18N[lang] && I18N[lang].categories) Object.assign(I18N[lang].categories, CATEGORY_LABEL_PATCH[lang]);
  });


  const EXTRA_I18N = {
    ko:{ navTerms:'이용약관', statusLabel:'공개 상태', statusPublic:'공개', statusPrivate:'비밀', statusDraft:'임시저장', draftBadge:'임시저장', contentKindLabel:'콘텐츠 종류', contentKindProject:'프로젝트', contentKindPost:'포스트', addPost:'포스트 추가', typePost:'포스트', formatPost:'포스트', postBodyRequired:'포스트는 본문, 설명, 이미지 중 하나가 필요합니다.', postDetailLabel:'포스트 본문', postDetailHint:'블로그 글처럼 자유롭게 내용을 적고, 필요한 이미지를 함께 올릴 수 있습니다.', projectSourceHint:'프로젝트 모드에서는 HTML/JSX/TSX/ZIP 파일 또는 코드를 넣어주세요.', exportProjects:'목록 복사', exportCopied:'프로젝트 목록을 복사했습니다.', systemStatus:'시스템 상태', fillDetailDraft:'상세 소개 초안 채우기', detailQualityGood:'상세 소개가 충분합니다.', detailQualityShort:'상세 소개가 짧습니다. 광고 심사용 상세 페이지는 조금 더 적는 편이 안전합니다.', detailChars:'글자 수', imageOptimized:'이미지를 업로드용으로 줄였습니다.', zipTooLarge:'파일이 너무 큽니다. 이미지/영상/음악을 줄이거나 파일별 업로드가 필요합니다.', zipEntryTooLarge:'ZIP 안에 50MB를 넘는 파일이 있습니다.', zipBrowserLarge:'ZIP 전체 용량이 커서 브라우저 메모리를 많이 사용할 수 있습니다. 그래도 내부 파일 기준으로 검사합니다.', zipReady:'ZIP 검사 완료: index.html을 찾았습니다.', zipUploadCheck:'ZIP 검사 중...', zipUploadExtract:'ZIP 압축 해제 중...', zipUploadFiles:'ZIP 내부 파일 업로드 중...', zipUploadManifest:'ZIP manifest 생성 중...', zipStorageNotReady:'Storage가 준비되지 않아 ZIP 저장을 진행할 수 없습니다.' },
    en:{ navTerms:'Terms', statusLabel:'Visibility', statusPublic:'Public', statusPrivate:'Private', statusDraft:'Draft', draftBadge:'Draft', contentKindLabel:'Content type', contentKindProject:'Project', contentKindPost:'Post', addPost:'Add Post', typePost:'Post', formatPost:'Post', postBodyRequired:'A post needs body text, a description, or an image.', postDetailLabel:'Post body', postDetailHint:'Write freely like a blog post and attach images if needed.', projectSourceHint:'Project mode needs an HTML/JSX/TSX/ZIP file or code.', exportProjects:'Copy List', exportCopied:'Project list copied.', systemStatus:'System Status', fillDetailDraft:'Fill detail draft', detailQualityGood:'Project details look sufficient.', detailQualityShort:'Project details are short. Add more for a stronger content page.', detailChars:'Characters', imageOptimized:'Image optimized for upload.', zipTooLarge:'The file is too large. Reduce images, video or audio, or upload files separately.', zipEntryTooLarge:'A file inside the ZIP exceeds 50MB.', zipBrowserLarge:'The ZIP is large and may use a lot of browser memory. It will still be checked by individual file size.', zipReady:'ZIP check complete: index.html was found.', zipUploadCheck:'Checking ZIP...', zipUploadExtract:'Extracting ZIP...', zipUploadFiles:'Uploading ZIP files...', zipUploadManifest:'Creating ZIP manifest...', zipStorageNotReady:'Storage is not ready, so ZIP saving cannot continue.' },
    ja:{ navTerms:'利用規約', statusLabel:'公開状態', statusPublic:'公開', statusPrivate:'非公開', statusDraft:'下書き', draftBadge:'下書き', contentKindLabel:'コンテンツ種別', contentKindProject:'プロジェクト', contentKindPost:'ポスト', addPost:'ポスト追加', typePost:'ポスト', formatPost:'ポスト', postBodyRequired:'ポストには本文、説明、画像のいずれかが必要です。', postDetailLabel:'ポスト本文', postDetailHint:'ブログ記事のように自由に本文を書き、必要な画像を添付できます。', projectSourceHint:'プロジェクトモードではHTML/JSX/TSX/ZIPファイルまたはコードが必要です。', exportProjects:'一覧コピー', exportCopied:'プロジェクト一覧をコピーしました。', systemStatus:'システム状態', fillDetailDraft:'詳細文の下書き', detailQualityGood:'詳細紹介は十分です。', detailQualityShort:'詳細紹介が短めです。審査用ページにはもう少し追加すると安心です。', detailChars:'文字数', imageOptimized:'画像をアップロード用に軽量化しました。', zipTooLarge:'ファイルが大きすぎます。画像・動画・音声を減らすか、ファイル別アップロードが必要です。', zipEntryTooLarge:'ZIP内に50MBを超えるファイルがあります。', zipBrowserLarge:'ZIP全体の容量が大きいためブラウザメモリを多く使う可能性があります。個別ファイルサイズ基準で検査します。', zipReady:'ZIP検査完了: index.htmlを検出しました。', zipUploadCheck:'ZIPを確認中...', zipUploadExtract:'ZIPを展開中...', zipUploadFiles:'ZIP内ファイルをアップロード中...', zipUploadManifest:'ZIP manifestを作成中...', zipStorageNotReady:'Storageが準備されていないためZIP保存を続行できません。' },
    zh:{ navTerms:'使用条款', statusLabel:'公开状态', statusPublic:'公开', statusPrivate:'私密', statusDraft:'草稿', draftBadge:'草稿', contentKindLabel:'内容类型', contentKindProject:'项目', contentKindPost:'帖子', addPost:'添加帖子', typePost:'帖子', formatPost:'帖子', postBodyRequired:'帖子需要正文、说明或图片中的至少一项。', postDetailLabel:'帖子正文', postDetailHint:'可以像博客文章一样自由书写，也可以附加图片。', projectSourceHint:'项目模式需要 HTML/JSX/TSX/ZIP 文件或代码。', exportProjects:'复制列表', exportCopied:'项目列表已复制。', systemStatus:'系统状态', fillDetailDraft:'生成详细介绍草稿', detailQualityGood:'详细介绍内容较充足。', detailQualityShort:'详细介绍偏短。为了内容页更完整，建议再补充一些。', detailChars:'字数', imageOptimized:'图片已优化用于上传。', zipTooLarge:'文件太大。请减少图片、视频或音频，或改为分文件上传。', zipEntryTooLarge:'ZIP 内有超过 50MB 的文件。', zipBrowserLarge:'ZIP 整体较大，可能占用较多浏览器内存。仍会按内部单个文件大小检查。', zipReady:'ZIP 检查完成：已找到 index.html。', zipUploadCheck:'正在检查 ZIP...', zipUploadExtract:'正在解压 ZIP...', zipUploadFiles:'正在上传 ZIP 内部文件...', zipUploadManifest:'正在创建 ZIP manifest...', zipStorageNotReady:'Storage 尚未准备好，无法继续保存 ZIP。' }
  };

  const V24_I18N = {
    ko:{ navPosts:'포스트', postsEyebrow:'포스트', postsTitle:'포스트 아카이브', postsBody:'작업 기록, 이미지, 파일 메모를 블로그 포스트처럼 정리합니다.', postSectionKicker:'포스트', postsGalleryTitle:'포스트 아카이브', postSearchPlaceholder:'포스트 검색...', viewAllPosts:'전체 포스트 보기', filterSecret:'비밀', emptyPostTitle:'아직 공개된 포스트가 없습니다.', emptyPostText:'글, 이미지, 파일 메모를 포스트로 추가하면 이곳에 정리됩니다.', emptySecretTitle:'비밀 항목이 없습니다.', emptySecretText:'비밀 프로젝트와 비밀 포스트는 이 필터에서만 따로 보입니다.', postFilesLabel:'첨부 파일', postFilesHint:'포스트에 함께 보여줄 파일을 첨부할 수 있습니다.' },
    en:{ navPosts:'Posts', postsEyebrow:'POSTS', postsTitle:'Post Archive', postsBody:'Notes, images, files, and making logs can be organized like blog posts.', postSectionKicker:'Posts', postsGalleryTitle:'Post Archive', postSearchPlaceholder:'Search posts...', viewAllPosts:'View All Posts', filterSecret:'Secret', emptyPostTitle:'No public posts yet.', emptyPostText:'Add notes, images, or file memos as posts and they will appear here.', emptySecretTitle:'No secret items.', emptySecretText:'Private projects and posts only appear in this filter.', postFilesLabel:'Attached files', postFilesHint:'Attach files that should be shown with this post.' },
    ja:{ navPosts:'ポスト', postsEyebrow:'POSTS', postsTitle:'ポストアーカイブ', postsBody:'制作記録、画像、ファイルメモをブログ記事のように整理します。', postSectionKicker:'ポスト', postsGalleryTitle:'ポストアーカイブ', postSearchPlaceholder:'ポスト検索...', viewAllPosts:'すべてのポスト', filterSecret:'非公開', emptyPostTitle:'公開ポストはまだありません。', emptyPostText:'文章、画像、ファイルメモをポストとして追加するとここに表示されます。', emptySecretTitle:'非公開項目はありません。', emptySecretText:'非公開プロジェクトとポストはこのフィルターにだけ表示されます。', postFilesLabel:'添付ファイル', postFilesHint:'ポストと一緒に表示するファイルを添付できます。' },
    zh:{ navPosts:'帖子', postsEyebrow:'POSTS', postsTitle:'帖子归档', postsBody:'可以像博客文章一样整理制作记录、图片和文件备忘。', postSectionKicker:'帖子', postsGalleryTitle:'帖子归档', postSearchPlaceholder:'搜索帖子...', viewAllPosts:'查看全部帖子', filterSecret:'私密', emptyPostTitle:'还没有公开帖子。', emptyPostText:'把文字、图片或文件备忘添加为帖子后会显示在这里。', emptySecretTitle:'没有私密项目。', emptySecretText:'私密项目和帖子只会出现在这个筛选中。', postFilesLabel:'附件', postFilesHint:'可以添加要随帖子显示的文件。' }
  };
  Object.keys(V24_I18N).forEach(lang => Object.assign(EXTRA_I18N[lang] || (EXTRA_I18N[lang] = {}), V24_I18N[lang]));

  const V25_I18N = {
    ko:{ postSidebarTitle:'ERBELLO NOTE', postSidebarBody:'글, 이미지, 파일 기록을 카테고리별로 모아둡니다.', postCategoryTitle:'category', postRecentTitle:'recent posts', postCount:'개의 글', postNoRecent:'아직 글이 없습니다.', postNotice:'공지', postListLabel:'글 제목', postDateLabel:'작성일' },
    en:{ postSidebarTitle:'ERBELLO NOTE', postSidebarBody:'Writing, images, and file notes are grouped by category.', postCategoryTitle:'category', postRecentTitle:'recent posts', postCount:'posts', postNoRecent:'No posts yet.', postNotice:'Notice', postListLabel:'Post title', postDateLabel:'Date' },
    ja:{ postSidebarTitle:'ERBELLO NOTE', postSidebarBody:'文章、画像、ファイル記録をカテゴリー別にまとめます。', postCategoryTitle:'category', postRecentTitle:'recent posts', postCount:'件の記事', postNoRecent:'記事はまだありません。', postNotice:'お知らせ', postListLabel:'記事タイトル', postDateLabel:'作成日' },
    zh:{ postSidebarTitle:'ERBELLO NOTE', postSidebarBody:'按分类整理文字、图片和文件记录。', postCategoryTitle:'category', postRecentTitle:'recent posts', postCount:'篇文章', postNoRecent:'还没有文章。', postNotice:'公告', postListLabel:'文章标题', postDateLabel:'日期' }
  };
  Object.keys(V25_I18N).forEach(lang => Object.assign(EXTRA_I18N[lang] || (EXTRA_I18N[lang] = {}), V25_I18N[lang]));

  const V26_I18N = {
    ko:{ filterOrderLabel:'필터 순서', filterOrderHint:'쉼표로 순서를 적어주세요. 포스트 예: all, daily, study, cooking, game, fandom, design, other, secret', postAssetsLabel:'포스트 에셋', postAssetsHint:'누르면 본문에 이미지 마크다운이 삽입됩니다. 구분선, 인덱스, 일상/공부/요리/게임/덕질 스티커를 바로 쓸 수 있어요.', insertAsset:'에셋 삽입', typeStudy:'공부', typeCooking:'요리', typeFandom:'덕질' },
    en:{ filterOrderLabel:'Filter order', filterOrderHint:'Enter keys separated by commas. Post example: all, daily, study, cooking, game, fandom, design, other, secret', postAssetsLabel:'Post assets', postAssetsHint:'Click an asset to insert image markdown into the post body.', insertAsset:'Insert asset', typeStudy:'Study', typeCooking:'Cooking', typeFandom:'Fandom' },
    ja:{ filterOrderLabel:'フィルター順序', filterOrderHint:'カンマ区切りで順序を入力します。ポスト例: all, daily, study, cooking, game, fandom, design, other, secret', postAssetsLabel:'ポスト素材', postAssetsHint:'クリックすると本文に画像Markdownを挿入します。', insertAsset:'素材を挿入', typeStudy:'勉強', typeCooking:'料理', typeFandom:'推し活' },
    zh:{ filterOrderLabel:'筛选顺序', filterOrderHint:'请用逗号分隔键名。帖子示例: all, daily, study, cooking, game, fandom, design, other, secret', postAssetsLabel:'帖子素材', postAssetsHint:'点击后会把图片 Markdown 插入正文。', insertAsset:'插入素材', typeStudy:'学习', typeCooking:'料理', typeFandom:'追星' }
  };
  Object.keys(V26_I18N).forEach(lang => Object.assign(EXTRA_I18N[lang] || (EXTRA_I18N[lang] = {}), V26_I18N[lang]));

  const V28_I18N = {
    ko:{ postAssetsHint:'누르거나 본문으로 끌어오면 이미지 마크다운이 삽입됩니다. 구분선, 인덱스, 일상/공부/요리/게임/덕질 스티커를 바로 쓸 수 있어요.', postMajorCategoryLabel:'큰 분류', postSubcategoryLabel:'작은 분류', postSubcategoryPlaceholder:'예: 노래방 번호 정리', postReaderEmpty:'아직 본문이 없습니다.', postReaderChoose:'읽을 포스트를 선택해주세요.', postInlineTitle:'본문 미리보기', postOpenHint:'목록에서 글을 선택하면 이곳에 바로 표시됩니다.' },
    en:{ postAssetsHint:'Click or drag an asset into the body to insert image markdown.', postMajorCategoryLabel:'Main category', postSubcategoryLabel:'Subcategory', postSubcategoryPlaceholder:'Example: karaoke song list', postReaderEmpty:'This post has no body yet.', postReaderChoose:'Choose a post to read.', postInlineTitle:'Post reader', postOpenHint:'Select a post from the list to read it here.' },
    ja:{ postAssetsHint:'クリック、または本文へドラッグすると画像Markdownを挿入できます。', postMajorCategoryLabel:'大分類', postSubcategoryLabel:'小分類', postSubcategoryPlaceholder:'例：カラオケ番号整理', postReaderEmpty:'本文はまだありません。', postReaderChoose:'読む記事を選択してください。', postInlineTitle:'本文プレビュー', postOpenHint:'一覧から記事を選ぶとここに表示されます。' },
    zh:{ postAssetsHint:'点击或拖到正文中即可插入图片 Markdown。', postMajorCategoryLabel:'大分类', postSubcategoryLabel:'小分类', postSubcategoryPlaceholder:'例如：K 歌编号整理', postReaderEmpty:'正文尚为空。', postReaderChoose:'请选择要阅读的帖子。', postInlineTitle:'正文预览', postOpenHint:'从列表中选择帖子后会在这里直接显示。' }
  };
  Object.keys(V28_I18N).forEach(lang => Object.assign(EXTRA_I18N[lang] || (EXTRA_I18N[lang] = {}), V28_I18N[lang]));

  let artifacts = [];
  let pageRows = [];
  let currentRoute = initialRoute();
  let currentFilter = 'all';
  let searchQuery = '';
  let currentLang = 'ko';
  let adminToken = safeStorage.get('session', 'erbello-admin-token') || '';
  let currentId = null;
  let selectedPostId = null;
  let editingId = null;
  let pendingSourceFile = null;
  let pendingSourceStored = false;
  let pendingSourceName = '';
  let pendingZipInfo = null;
  let pendingCoverImage = '';
  let pendingCoverFile = null;
  let pendingGalleryImages = [];
  let pendingGalleryFiles = [];
  let pendingPostAttachments = [];
  let pendingPostFiles = [];
  let systemStatusCache = null;
  let toastTimer = null;

  function dict() { return I18N[currentLang] || I18N.ko; }
  function tr(key) { return (EXTRA_I18N[currentLang] && EXTRA_I18N[currentLang][key]) ?? dict()[key] ?? (EXTRA_I18N.ko && EXTRA_I18N.ko[key]) ?? I18N.ko[key] ?? key; }
  function catLabel(type) { return type === 'secret' ? tr('filterSecret') : (type === 'post' ? tr('typePost') : (dict().categories[type] || dict().categories.other)); }
  function colorLabel(color) { return (dict().colors && dict().colors[color]) || (I18N.en.colors && I18N.en.colors[color]) || color; }
  function schemeLabel(scheme) { return (dict().schemes && dict().schemes[scheme]) || (I18N.en.schemes && I18N.en.schemes[scheme]) || scheme; }
  function colorShortLabel(color) { return ({ crimson:'Crim', sky:'Sky', lavender:'Lav', yellowblue:'YB', cream:'Cream', rose:'Rose', ocean:'Ocean', aurora:'Aurora', mint:'Mint', pixel:'Pixel' })[color] || colorLabel(color); }
  function themeButtonLabel(scheme, color) { return `${scheme === 'white' ? 'W' : 'B'} · ${colorShortLabel(color)}`; }
  function esc(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function compact(value, max = 150) { const text = String(value || '').replace(/\s+/g, ' ').trim(); return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text; }
  function typeKey(value) { const t = String(value || 'other').toLowerCase(); if (t === 'html' || t === 'react') return 'tool'; return CATEGORIES.includes(t) && !['all','secret','post'].includes(t) ? t : 'other'; }
  function cleanTags(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/[#,，、\n]+/);
    const seen = new Set();
    const tags = [];
    for (const item of raw) {
      const tag = String(item || '').replace(/^#+/, '').trim().replace(/\s+/g, ' ').slice(0, 28);
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) continue;
      seen.add(key); tags.push(tag);
      if (tags.length >= 20) break;
    }
    return tags;
  }
  function tagsText(value) { return cleanTags(value).join(', '); }
  function tagsToInput(value) { return tagsText(value); }
  function formatKey(item = {}) {
    if (typeof item === 'string') return ['html','jsx','zip','post'].includes(item) ? item : 'html';
    const raw = String(item.source_kind || item.format || '').toLowerCase();
    if (['html','jsx','zip','post'].includes(raw)) return raw;
    return item.is_jsx ? 'jsx' : 'html';
  }
  function formatLabel(item = {}) { const f = formatKey(item); return f === 'post' ? tr('formatPost') : (f === 'zip' ? tr('formatZip') : (f === 'jsx' ? tr('formatJsx') : tr('formatHtml'))); }
  function isPostItem(item = {}) { return formatKey(item) === 'post'; }

  function statusKey(item = {}) {
    const s = String(item.status || '').toLowerCase();
    if (['public','private','draft'].includes(s)) return s;
    return item.is_private ? 'private' : 'public';
  }
  function statusLabel(key) {
    const s = String(key || 'public').toLowerCase();
    return s === 'draft' ? tr('statusDraft') : (s === 'private' ? tr('statusPrivate') : tr('statusPublic'));
  }

  function categoryTerms(key) {
    const terms = new Set([key]);
    Object.values(I18N).forEach(dict => { if (dict.categories && dict.categories[key]) terms.add(String(dict.categories[key]).toLowerCase()); });
    ({ secret:['secret','private','비밀','비공개','非公開','私密'], post:['post','blog','포스트','블로그','記事','投稿','帖子','文章'], tool:['tool','도구','ツール','工具'], game:['game','게임','ゲーム','游戏'], daily:['daily','일상','日常'], study:['study','공부','학습','勉強','学习'], cooking:['cooking','cook','요리','料理'], fandom:['fandom','덕질','굿즈','推し活','追星'], design:['design','디자인','デザイン','设计'], chart:['chart','차트','图表'], experiment:['experiment','실험','実験','实验'], other:['other','기타','その他','其他'] }[key] || []).forEach(v => terms.add(v.toLowerCase()));
    return terms;
  }
  function matchesFilter(item, filter) {
    if (filter === 'all') return true;
    if (filter === 'secret') return isSecretItem(item);
    const type = typeKey(item.type);
    const terms = cleanTags(item.tags).map(tag => tag.toLowerCase());
    const allowed = categoryTerms(filter);
    return type === filter || terms.some(tag => allowed.has(tag));
  }
  function defaultFilterKeysForRoute(route = currentRoute) {
    return route === 'posts'
      ? ['all', 'daily', 'study', 'cooking', 'game', 'fandom', 'design', 'other', 'secret']
      : ['all', 'tool', 'game', 'daily', 'design', 'chart', 'experiment', 'other', 'secret'];
  }
  function normalizeFilterOrder(value, route = currentRoute) {
    const defaults = defaultFilterKeysForRoute(route);
    const raw = Array.isArray(value) ? value : String(value || '').split(/[\s,|/]+/);
    const seen = new Set();
    const ordered = [];
    for (const item of raw) {
      const key = String(item || '').trim().toLowerCase();
      if (!defaults.includes(key) || seen.has(key)) continue;
      seen.add(key);
      ordered.push(key);
    }
    for (const key of defaults) {
      if (!seen.has(key)) ordered.push(key);
    }
    if (ordered.includes('secret')) {
      ordered.splice(ordered.indexOf('secret'), 1);
      ordered.push('secret');
    }
    return ordered;
  }
  function filterKeysForRoute(route = currentRoute) {
    const page = pageContent(route, currentLang);
    return normalizeFilterOrder(page.filterOrder, route);
  }
  function isSecretItem(item = {}) { return statusKey(item) === 'private' || Boolean(item.is_private); }
  function routeContentKind(route = currentRoute) { return route === 'posts' ? 'post' : 'project'; }
  function itemBelongsToRoute(item, route = currentRoute) {
    if (route === 'posts') return isPostItem(item);
    if (route === 'projects') return !isPostItem(item);
    return true;
  }
  function normalizeTags(value) { return cleanTags(value); }
  function normalizeTagValue(value) { return String(value || '').replace(/^#+/, '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function tagMatchesCategory(tag, key) { const normalized = normalizeTagValue(tag); return normalized === key || categoryTerms(key).has(normalized); }
  function artifactTags(item) { return cleanTags(item && item.tags); }
  function isSubcategoryTag(tag) { return normalizeTagValue(tag).startsWith(POST_SUBCATEGORY_PREFIX); }
  function visibleArtifactTags(item) { return artifactTags(item).filter(tag => !isSubcategoryTag(tag)); }
  function postSubcategory(item) {
    const tag = artifactTags(item).find(isSubcategoryTag);
    if (!tag) return '';
    return String(tag).slice(String(tag).indexOf(':') + 1).trim();
  }
  function postTagPayload(tags, subcategory) {
    const base = cleanTags(tags).filter(tag => !isSubcategoryTag(tag));
    const sub = String(subcategory || '').replace(/^#+/, '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return sub ? [...base, `${POST_SUBCATEGORY_PREFIX}${sub}`] : base;
  }
  function gamsungCover(seed) {
    if (!GAMSUNG_COVERS.length) return '/assets/illust/cover-abstract.webp';
    const key = String(seed || 'gamsung-default');
    if (!gamsungSessionCovers.has(key)) {
      gamsungSessionCovers.set(key, GAMSUNG_COVERS[Math.floor(Math.random() * GAMSUNG_COVERS.length)]);
    }
    return gamsungSessionCovers.get(key);
  }

  function isRandomGamsungCover(value) {
    return String(value || '').trim() === RANDOM_GAMSUNG_COVER;
  }

  function coverImageSrc(value, item = {}) {
    const cover = String(value || '').trim();
    if (!cover) return '';
    if (isRandomGamsungCover(cover)) return gamsungCover(item.id || item.title || 'pending-cover');
    return cover;
  }

  function artifactCover(item) {
    const cover = String(item && item.cover_image || '').trim();
    const custom = coverImageSrc(cover, item || {});
    if (custom) return custom;
    const profile = visualProfile(item || {});
    const map = { 'visual-receipt':'/assets/illust/cover-receipt.webp', 'visual-tarot':'/assets/illust/cover-tarot.webp', 'visual-typing':'/assets/illust/cover-typing.webp', 'visual-pudding':'/assets/illust/cover-pudding.webp', 'visual-note':'/assets/illust/cover-note.webp', 'visual-box':'/assets/illust/cover-random.webp', 'visual-night':'/assets/illust/cover-diary.webp', 'visual-cherry':'/assets/illust/cover-cherry.webp', 'visual-ocean':'/assets/illust/cover-ocean.webp' };
    return map[profile.klass] || gamsungCover(item && (item.id || item.title) || 'default-cover');
  }
  function galleryImages(item) {
    return Array.isArray(item && item.gallery_images) ? item.gallery_images.filter(Boolean).slice(0, 8) : [];
  }
  function itemMatchesFilter(item, filter) { return matchesFilter(item, filter); }
  function isAdminOn() { return document.body.classList.contains('admin-on'); }
  function runPath(id) { return `/run/${encodeURIComponent(id)}`; }
  function projectPath(id) { return `/project/${encodeURIComponent(id)}`; }
  function runUrl(id) { return PREVIEW_MODE ? `#preview-${encodeURIComponent(id)}` : `${SITE_ORIGIN}${runPath(id)}`; }
  function projectUrl(id) { return PREVIEW_MODE ? `#preview-${encodeURIComponent(id)}` : `${SITE_ORIGIN}${projectPath(id)}`; }
  function pageUrl(route) { return route === 'home' ? '/' : `/${route}`; }

  function initialRoute() {
    const path = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (path === 'projects' || path === 'posts' || path === 'about' || path === 'contact' || path === 'privacy' || path === 'terms') return path;
    return 'home';
  }

  function clone(value) { return JSON.parse(JSON.stringify(value || {})); }

  const POLICY_PAGES = {
    ko: {
      privacy:{ eyebrow:'PRIVACY', title:'개인정보처리방침', body:'이 사이트는 ERBELLO가 만든 프로젝트 갤러리 운영과 기본적인 사이트 이용을 위해 필요한 최소한의 정보만 사용합니다.', blocks:[{title:'수집하는 정보', text:'방문 기록, 조회수, 문의 링크 이용과 같이 사이트 운영에 필요한 기본 정보가 사용될 수 있습니다.'},{title:'광고와 쿠키', text:'Google AdSense가 광고 제공 및 통계 목적으로 쿠키를 사용할 수 있습니다.'},{title:'문의', text:'개인정보 관련 문의는 연락처 페이지의 링크를 통해 보낼 수 있습니다.'}] },
      terms:{ eyebrow:'TERMS', title:'이용약관', body:'ERBELLO라는 활동명으로 만든 개인 프로젝트 갤러리 이용에 관한 기본 안내입니다.', blocks:[{title:'개인 프로젝트 갤러리', text:'이 사이트는 ERBELLO라는 활동명으로 만든 HTML, JSX, ZIP 기반 개인 프로젝트를 정리하고 공유하기 위한 갤러리입니다.'},{title:'콘텐츠 이용', text:'등록된 프로젝트의 저작권과 책임은 각 프로젝트 작성자에게 있으며, 무단 복제나 재배포는 권장하지 않습니다.'},{title:'서비스 변경', text:'사이트 구조, 프로젝트, 링크, 기능은 운영 상황에 따라 수정되거나 삭제될 수 있습니다.'}] }
    },
    en: {
      privacy:{ eyebrow:'PRIVACY', title:'Privacy Policy', body:'This site uses only the minimum information needed to run the project gallery made by ERBELLO and its basic features.', blocks:[{title:'Information used', text:'Basic operational data such as visit activity, view counts, and contact link usage may be used.'},{title:'Ads and cookies', text:'Google AdSense may use cookies for ad delivery and measurement.'},{title:'Contact', text:'For privacy questions, use the links on the contact page.'}] },
      terms:{ eyebrow:'TERMS', title:'Terms', body:'Basic terms for using the personal project gallery made under the name ERBELLO.', blocks:[{title:'Personal project gallery', text:'This site organizes and shares HTML, JSX and ZIP-based personal projects made under the name ERBELLO.'},{title:'Content use', text:'Project rights and responsibilities remain with each project author. Unauthorized copying or redistribution is not recommended.'},{title:'Service changes', text:'Site structure, projects, links and features may be changed or removed depending on operation needs.'}] }
    },
    ja: {
      privacy:{ eyebrow:'PRIVACY', title:'プライバシーポリシー', body:'このサイトは、ERBELLOが制作したプロジェクトギャラリーの運営と基本機能のために必要最小限の情報を使用します。', blocks:[{title:'使用する情報', text:'訪問記録、閲覧数、連絡先リンク利用など、運営に必要な基本情報が使われる場合があります。'},{title:'広告とCookie', text:'Google AdSenseが広告配信と測定のためにCookieを使用する場合があります。'},{title:'お問い合わせ', text:'個人情報に関するお問い合わせは連絡先ページのリンクをご利用ください。'}] },
      terms:{ eyebrow:'TERMS', title:'利用規約', body:'ERBELLOという活動名で制作した個人プロジェクトギャラリー利用に関する基本案内です。', blocks:[{title:'個人プロジェクトギャラリー', text:'このサイトは、ERBELLOという活動名で制作したHTML、JSX、ZIPベースの個人プロジェクトを整理し共有するためのギャラリーです。'},{title:'コンテンツ利用', text:'登録されたプロジェクトの権利と責任は各作成者にあります。無断複製や再配布は推奨しません。'},{title:'サービス変更', text:'サイト構造、プロジェクト、リンク、機能は運営状況により変更または削除される場合があります。'}] }
    },
    zh: {
      privacy:{ eyebrow:'PRIVACY', title:'隐私政策', body:'本网站仅使用运行 ERBELLO 制作的项目画廊和基本网站功能所需的最少信息。', blocks:[{title:'使用的信息', text:'可能使用访问记录、浏览量、联系链接使用等运营所需的基本信息。'},{title:'广告和 Cookie', text:'Google AdSense 可能会使用 Cookie 用于广告投放和统计。'},{title:'联系', text:'有关隐私的问题，可通过联系页面的链接发送。'}] },
      terms:{ eyebrow:'TERMS', title:'使用条款', body:'这是关于使用以 ERBELLO 这一活动名制作的个人项目画廊的基本说明。', blocks:[{title:'个人项目画廊', text:'本网站用于整理和分享以 ERBELLO 这一活动名制作的 HTML、JSX、ZIP 类个人项目。'},{title:'内容使用', text:'已登记项目的权利与责任属于各项目作者，不建议未经许可复制或再分发。'},{title:'服务变更', text:'网站结构、项目、链接和功能可能根据运营情况修改或删除。'}] }
    }
  };

  function policyDefaultPage(slug, lang) {
    const set = POLICY_PAGES[lang] || POLICY_PAGES.ko;
    return set && set[slug] ? clone(set[slug]) : null;
  }

  function routeDefaultPage(slug, lang) {
    if (slug !== 'posts') return null;
    const map = {
      ko:{ eyebrow:'포스트', title:'포스트 아카이브', body:'작업 기록, 이미지, 파일 메모를 블로그 포스트처럼 정리합니다.', infoTitle:'', blocks:[] },
      en:{ eyebrow:'POSTS', title:'Post Archive', body:'Notes, images, files, and making logs can be organized like blog posts.', infoTitle:'', blocks:[] },
      ja:{ eyebrow:'POSTS', title:'ポストアーカイブ', body:'制作記録、画像、ファイルメモをブログ記事のように整理します。', infoTitle:'', blocks:[] },
      zh:{ eyebrow:'POSTS', title:'帖子归档', body:'可以像博客文章一样整理制作记录、图片和文件备忘。', infoTitle:'', blocks:[] }
    };
    return clone(map[lang] || map.ko);
  }

  const PAGE_CONTENT_DEFAULTS = {
    ko: {
      about: {
        eyebrow:'ABOUT',
        title:'ERBELLO의 프로젝트 갤러리',
        body:`이곳은 ERBELLO라는 활동명으로 만들고 있는 작은 웹 프로젝트들을 모아둔 개인 갤러리입니다. 완성된 HTML 페이지, React/JSX 아티팩트, 미니 게임, 생활형 도구, 디자인 관련 페이지처럼 직접 열어보고 사용할 수 있는 작업물을 하나씩 정리하고 있습니다.

전문 개발자의 공식 포트폴리오라기보다는, 혼자 배우고 만들면서 쌓아가는 개인 저장소에 더 가깝습니다. 아직 부족하거나 어색한 부분도 많지만, 떠오른 아이디어를 실제로 눌러보고 실행할 수 있는 형태로 남겨두고 싶어서 이 공간을 만들었습니다.

방문해주신 분들이 필요한 도구를 발견하거나, 잠깐 즐길 수 있는 작은 페이지를 찾아보거나, “이런 식으로도 웹 프로젝트를 만들 수 있구나” 하고 가볍게 구경해주시면 좋겠습니다. 모든 프로젝트가 완벽하진 않지만, 천천히 고치고 다듬으면서 조금씩 업데이트해보려 합니다. 모두 잘 부탁드려요!!`,
        infoTitle:'ABOUT.INFO',
        blocks:[
          {title:'프로젝트란?', text:`이곳에 올라오는 프로젝트들은 AI의 도움을 받아 혼자 독학하며 제작하고 있는 개인 작업물입니다. 처음부터 전문적인 개발 지식을 갖추고 시작한 것은 아니라서, 기능이나 구조가 완벽하지 않을 수도 있고, 어떤 부분은 실험적인 형태로 남아 있을 수도 있습니다.

그래도 단순히 아이디어로만 두지 않고, 실제로 열어보고 사용할 수 있는 웹페이지 형태로 만들어보는 것을 목표로 하고 있습니다. 어떤 프로젝트는 생활에 도움이 되는 도구이고, 어떤 프로젝트는 짧게 즐길 수 있는 게임이며, 어떤 프로젝트는 디자인이나 기록을 위한 작은 실험에 가깝습니다.

부족함과 어색함이 있더라도, 누군가에게 작게나마 도움이 되거나 재미있는 구경거리가 되었으면 좋겠습니다. 이 갤러리는 완성된 결과물만 모아두는 곳이라기보다, 배우고 만들고 고쳐나가는 과정을 함께 담아두는 공간입니다.`},
          {title:'활동명 ERBELLO', text:`ERBELLO는 제가 개인 작업과 활동에서 사용하고 있는 활동명입니다. 처음에는 네이버 블로그를 통해 여러 기록과 작업을 남기기 시작했고, 지금은 주로 Twitter에서 그림, 아이디어, 작은 제작물들을 공유하며 활동하고 있습니다.

그림이나 음악처럼 직접 표현하는 작업을 좋아하고, 최근에는 HTML 페이지나 간단한 웹앱처럼 사용자가 직접 눌러보고 체험할 수 있는 형태의 작업에도 관심을 두고 있습니다. 아직 개발은 천천히 배우는 중이라 완벽한 기술적 완성보다는, 제가 직접 써보고 싶거나 누군가에게 도움이 될 만한 작은 기능을 만들어보는 데 집중하고 있습니다.

이 사이트는 그런 과정에서 생긴 결과물들을 정리해두는 공간입니다. ERBELLO라는 이름으로 만든 여러 작업들을 한곳에 모아두고, 필요할 때 다시 꺼내보고, 방문자분들도 편하게 둘러볼 수 있도록 운영하고 있습니다.`},
          {title:'활동 계획', text:`새로운 작업물이 생기면 이 갤러리에 천천히 추가할 예정입니다. 생활에 도움이 되는 작은 도구, 짧게 즐길 수 있는 미니 게임, 디자인이나 기록에 쓸 수 있는 페이지처럼 부담 없이 열어볼 수 있는 프로젝트를 중심으로 만들어보려 합니다.

정교하고 어려운 서비스를 한 번에 만들기는 어렵지만, 작은 기능이라도 실제로 사용할 수 있는 형태로 완성해보는 것을 목표로 하고 있습니다. 이미 올린 프로젝트도 그대로 두기보다는, 필요할 때 설명을 보충하거나 디자인을 고치고, 기능을 조금씩 개선할 생각입니다.

이 갤러리는 ERBELLO의 작업물을 보여주는 공간이면서, 동시에 제가 배우고 시도한 것들을 남겨두는 기록이기도 합니다. 가볍게 만든 프로젝트라도 누군가에게 도움이 될 수 있다면 좋겠고, 앞으로도 천천히 새로운 작업을 추가해보겠습니다.`}
        ]
      },
      privacy: {
        eyebrow:'개인정보',
        title:'개인정보처리방침',
        body:`이 사이트는 ERBELLO라는 활동명으로 운영하는 개인 프로젝트 갤러리입니다. 방문자가 공개된 프로젝트를 둘러보고, 상세 페이지를 확인하고, 일부 도구나 게임을 실행해볼 수 있도록 구성되어 있습니다.

이 사이트는 회원가입을 요구하지 않으며, 일반 방문자가 프로젝트를 구경하는 과정에서 이름, 주소, 전화번호와 같은 직접적인 개인정보를 의도적으로 요청하지 않습니다. 다만 사이트 운영, 보안 확인, 프로젝트 조회수 기록, 오류 확인, 광고 제공과 같은 기본 기능을 위해 일부 기술적 정보가 사용될 수 있습니다.

수집되거나 사용될 수 있는 정보는 사이트를 안정적으로 운영하고, 프로젝트를 개선하며, 필요한 경우 광고와 통계 기능을 제공하기 위한 범위로 제한됩니다. ERBELLO는 방문자의 정보를 불필요하게 수집하거나 판매하는 것을 목적으로 하지 않습니다.`,
        infoTitle:'PRIVACY.INFO',
        blocks:[
          {title:'수집하는 정보', text:`이 사이트에서 사용될 수 있는 정보는 기본적인 사이트 운영에 필요한 정보로 제한됩니다. 예를 들어 방문한 페이지, 프로젝트 조회수, 오류 발생 여부, 브라우저나 기기 환경처럼 사이트가 정상적으로 작동하는지 확인하기 위한 정보가 포함될 수 있습니다.

관리자가 프로젝트를 추가하거나 수정할 때 입력한 제목, 설명, 태그, 이미지, 코드, 연락처 링크 등은 사이트 운영을 위해 저장됩니다. 이 정보들은 프로젝트 카드, 상세 페이지, 연락처 페이지 등에서 표시될 수 있습니다.

일반 방문자는 별도의 계정을 만들지 않고 사이트를 이용할 수 있습니다. 다만 프로젝트 이용 중 개인정보, 비밀번호, 결제 정보, 주민등록번호처럼 민감한 정보를 입력하는 것은 권장하지 않습니다. 외부 링크를 통해 다른 서비스로 이동하는 경우에는 해당 외부 서비스의 개인정보처리방침이 적용될 수 있습니다.`},
          {title:'광고와 쿠키', text:`이 사이트는 운영을 위해 Google AdSense와 같은 광고 서비스를 사용할 수 있습니다. 광고가 표시되는 경우, Google 또는 제3자 광고 제공업체가 쿠키를 사용하여 광고를 제공하거나 광고 성과를 측정하거나 부정 클릭을 방지할 수 있습니다.

쿠키는 방문자의 브라우저에 저장되는 작은 정보이며, 광고 제공, 통계 분석, 중복 광고 방지, 보안 확인 등에 사용될 수 있습니다. 방문자는 브라우저 설정을 통해 쿠키 저장을 제한하거나 삭제할 수 있으며, Google의 광고 설정을 통해 맞춤형 광고와 관련된 설정을 관리할 수 있습니다.

광고는 사이트 이용을 과도하게 방해하지 않도록 조정하려고 합니다. 프로젝트 실행 화면, 관리자 화면, 비밀 프로젝트 잠금 화면처럼 광고가 적절하지 않은 영역에는 광고를 제한하는 방향으로 운영합니다.`},
          {title:'보관 및 삭제', text:`사이트 운영을 위해 저장된 정보는 필요한 기간 동안 보관될 수 있습니다. 프로젝트 데이터, 조회수, 페이지 문구, 연락처 링크 등은 사이트 운영자가 직접 수정하거나 삭제할 때까지 유지될 수 있습니다.

불필요한 정보는 운영 과정에서 정리하거나 삭제할 수 있습니다. 사이트 구조 변경, 프로젝트 삭제, 서비스 이전, 저장 공간 관리 등의 이유로 일부 정보가 수정되거나 제거될 수도 있습니다.

방문자가 외부 링크를 통해 문의하거나 다른 서비스로 이동한 경우, 해당 외부 서비스에서 처리되는 정보는 이 사이트가 직접 관리하지 않습니다. 개인정보와 관련된 문의나 삭제 요청이 필요한 경우, 연락처 페이지에 등록된 링크를 통해 문의할 수 있습니다.`},
          {title:'문의', text:`개인정보처리방침과 관련하여 궁금한 점이 있거나, 사이트 이용 중 개인정보 관련 문의가 필요한 경우 연락처 페이지에 등록된 링크를 통해 문의할 수 있습니다.

이 사이트는 개인이 운영하는 프로젝트 갤러리이므로, 가능한 범위 안에서 문의 내용을 확인하고 필요한 조치를 하겠습니다. 단, 외부 서비스로 이동한 뒤 발생하는 정보 처리나 광고 플랫폼에서 자체적으로 처리하는 데이터는 해당 서비스의 정책을 따릅니다.

본 개인정보처리방침은 사이트 운영 방식, 광고 설정, 기능 변경에 따라 수정될 수 있습니다. 변경 사항이 생기면 이 페이지의 내용을 업데이트하는 방식으로 안내합니다.`}
        ]
      },
      terms: {
        eyebrow:'TERMS',
        title:'이용약관',
        body:`이 사이트는 ERBELLO라는 활동명으로 제작한 개인 프로젝트들을 정리하고 공유하기 위한 갤러리입니다. 방문자는 공개된 프로젝트를 둘러보고, 각 프로젝트의 상세 페이지와 실행 페이지를 이용할 수 있습니다.

이곳에 올라온 프로젝트들은 전문 서비스나 상업용 도구라기보다는, 개인 학습과 실험, 기록을 목적으로 제작된 작업물입니다. 일부 기능은 테스트 성격이 강할 수 있으며, 사용 환경에 따라 정상적으로 작동하지 않거나 화면 표시가 달라질 수 있습니다.

이 사이트를 이용하는 경우, 아래 안내 사항에 동의한 것으로 봅니다. 사이트의 구조, 기능, 프로젝트 목록, 링크, 정책 문구는 운영 상황에 따라 수정되거나 삭제될 수 있습니다.`,
        infoTitle:'TERMS.INFO',
        blocks:[
          {title:'개인 프로젝트 갤러리', text:`이 사이트는 완성된 HTML 페이지, React/JSX 아티팩트, 작은 게임과 도구를 정리해두는 개인 프로젝트 갤러리입니다. 각 프로젝트는 학습, 실험, 개인 사용, 공유를 목적으로 만들어졌으며, 모든 프로젝트가 전문적인 품질이나 완전한 안정성을 보장하는 것은 아닙니다.

방문자는 공개된 프로젝트를 직접 실행해볼 수 있지만, 중요한 업무나 민감한 정보 처리를 목적으로 사용하는 것은 권장하지 않습니다. 계산기, 변환기, 생성기 등의 도구는 참고용으로 제공되며, 결과의 정확성이나 특정 목적에 대한 적합성을 보장하지 않습니다.

비밀 프로젝트나 임시저장 프로젝트는 운영자의 설정에 따라 접근이 제한될 수 있습니다. 공개 상태, 프로젝트 구성, 링크, 설명 문구는 운영자의 판단에 따라 변경될 수 있습니다.`},
          {title:'콘텐츠 이용', text:`이 사이트에 등록된 프로젝트, 설명, 이미지, 디자인, 코드 구성 등은 별도의 표시가 없는 한 ERBELLO라는 활동명으로 운영자가 제작하거나 정리한 작업물입니다. 방문자는 사이트를 열람하고 개인적인 용도로 이용할 수 있지만, 무단 복제, 재배포, 상업적 이용, 출처를 지운 재게시 등은 권장하지 않습니다.

일부 프로젝트는 팬메이드, 비공식 도구, 개인 실험물의 성격을 가질 수 있습니다. 특정 게임, 캐릭터, 서비스, 브랜드를 참고하는 프로젝트가 있더라도 공식 서비스나 권리자와 직접적인 관련이 있음을 의미하지 않습니다.

외부 저작권, 상표권, 초상권 등 권리 문제가 우려되는 경우 연락처 페이지를 통해 문의할 수 있으며, 확인 후 가능한 범위에서 필요한 조치를 검토하겠습니다.`},
          {title:'사용자 주의사항', text:`방문자는 이 사이트의 프로젝트를 이용할 때 불법적인 목적, 타인의 권리를 침해하는 목적, 서비스에 과도한 부담을 주는 방식으로 이용해서는 안 됩니다. 프로젝트 실행 화면에 개인정보, 비밀번호, 결제 정보, 민감한 파일 등을 입력하는 것은 권장하지 않습니다.

일부 프로젝트는 브라우저 안에서 작동하는 미니 도구이므로, 사용자의 기기 환경, 브라우저 버전, 네트워크 상태에 따라 결과가 달라질 수 있습니다. 파일 변환, 코드 생성, 계산 기능 등을 사용할 때는 중요한 결과를 반드시 다시 확인하는 것이 좋습니다.

사이트 이용 중 외부 링크로 이동하는 경우, 해당 외부 사이트의 약관과 개인정보처리방침이 적용됩니다. 외부 사이트에서 발생하는 문제는 해당 서비스의 운영 정책을 따릅니다.`},
          {title:'책임의 제한', text:`이 사이트는 개인이 운영하는 프로젝트 갤러리이며, 사이트와 프로젝트는 가능한 범위에서 안정적으로 제공하려고 노력합니다. 다만 모든 기능이 항상 오류 없이 작동하거나, 모든 환경에서 동일하게 보이거나, 특정 목적에 완전히 적합하다는 점을 보장하지는 않습니다.

프로젝트 이용으로 인해 발생할 수 있는 데이터 손실, 계산 오류, 변환 결과 오류, 외부 링크 이용 문제, 사용자의 입력 실수 등에 대해서는 운영자가 모든 책임을 부담하기 어렵습니다. 중요한 작업이나 민감한 정보와 관련된 경우, 반드시 별도의 검토와 백업을 권장합니다.

사이트는 예고 없이 수정, 중단, 이전, 삭제될 수 있으며, 프로젝트별 공개 상태도 운영자의 판단에 따라 변경될 수 있습니다.`},
          {title:'광고와 외부 서비스', text:`이 사이트는 운영을 위해 Google AdSense와 같은 광고 서비스를 사용할 수 있습니다. 광고는 사이트 운영 비용을 보조하기 위한 목적으로 표시될 수 있으며, 광고의 내용과 연결되는 외부 사이트는 이 사이트가 직접 관리하지 않습니다.

방문자가 광고나 외부 링크를 클릭하여 다른 사이트로 이동하는 경우, 해당 사이트의 정책과 약관이 적용됩니다. 이 사이트는 외부 사이트의 콘텐츠, 상품, 서비스, 개인정보 처리 방식에 대해 직접적인 책임을 지지 않습니다.

광고가 사이트 이용을 과도하게 방해하지 않도록 위치와 노출 방식을 조정하려고 하며, 프로젝트 실행 화면이나 관리자 화면처럼 적절하지 않은 영역에는 광고를 제한하는 방향으로 운영합니다.`},
          {title:'서비스 변경', text:`이 사이트의 구조, 프로젝트 목록, 링크, 디자인, 기능, 정책 문구는 운영 상황에 따라 수정되거나 삭제될 수 있습니다. 새로운 프로젝트가 추가될 수도 있고, 기존 프로젝트가 비공개 또는 임시저장 상태로 변경될 수도 있습니다.

사이트 개선, 보안 문제, 저장 공간 관리, 외부 서비스 정책 변경, 광고 정책 대응 등의 이유로 일부 기능이 달라질 수 있습니다. 변경 사항은 사이트에 반영되는 방식으로 안내되며, 필요한 경우 관련 페이지의 내용을 수정할 수 있습니다.

이용자는 사이트를 계속 이용함으로써 변경된 내용에 동의한 것으로 볼 수 있습니다. 중요한 변경이 있을 경우 가능한 범위에서 페이지 내용을 업데이트해 안내하겠습니다.`}
        ]
      }
    },
    en: {
      about: {
        eyebrow:'ABOUT',
        title:"ERBELLO's Project Gallery",
        body:`This is a personal gallery that collects small web projects I make under the activity name ERBELLO. It organizes works that visitors can open and use directly, including completed HTML pages, React/JSX artifacts, mini games, everyday tools, and design-related pages.

Rather than an official portfolio by a professional developer, it is closer to a personal archive built while learning and making things on my own. Some parts may still be rough or awkward, but I created this space because I wanted to keep ideas in a form that can actually be opened, clicked, and run.

I hope visitors can find a useful tool, enjoy a small page for a moment, or casually see that web projects can be made in many different ways. Not every project is perfect, but I plan to keep fixing, polishing, and updating them little by little.`,
        infoTitle:'ABOUT.INFO',
        blocks:[
          {title:'What are these projects?', text:`The projects posted here are personal works I make while studying on my own with help from AI. I did not begin with professional development knowledge, so some features or structures may not be perfect, and some parts may remain experimental.

Even so, my goal is to turn ideas into web pages that can actually be opened and used, rather than leaving them only as ideas. Some projects are practical everyday tools, some are short games, and some are small experiments for design or records.

Even with rough edges, I hope they can be useful to someone in a small way or become something fun to look around. This gallery is not only a place for finished results, but also a space that keeps the process of learning, making, and improving.`},
          {title:'The activity name ERBELLO', text:`ERBELLO is the activity name I use for personal work and creative activity. I first started leaving records and work through a Naver blog, and now I mainly share drawings, ideas, and small creations on Twitter.

I like expressive work such as drawing and music, and recently I have also become interested in HTML pages and simple web apps that people can click, try, and experience directly. I am still learning development slowly, so instead of aiming for perfect technical completion, I focus on making small features that I personally want to use or that may help someone else.

This site is a place to organize the results that come from that process. It gathers works made under the name ERBELLO in one place, so I can revisit them when needed and visitors can browse them comfortably.`},
          {title:'Plans', text:`When new work is created, I plan to add it to this gallery gradually. I want to focus on projects that are easy to open without pressure, such as small everyday tools, short mini games, and pages for design or records.

It is hard to build a polished and complex service all at once, but my goal is to finish even small features in a form that can actually be used. For existing projects, I plan to add explanations, adjust designs, and improve functions little by little instead of leaving them as they are.

This gallery shows ERBELLO's work, and it is also a record of what I have learned and tried. Even a light project can be helpful to someone, so I will keep adding new work slowly.`}
        ]
      },
      privacy: {
        eyebrow:'PRIVACY',
        title:'Privacy Policy',
        body:`This site is a personal project gallery operated under the activity name ERBELLO. It is designed so visitors can browse public projects, read detail pages, and run some tools or games.

This site does not require membership, and it does not intentionally ask general visitors for direct personal information such as names, addresses, or phone numbers while they browse projects. However, some technical information may be used for basic functions such as site operation, security checks, project view counts, error checks, and advertising.

Any information that may be collected or used is limited to what is needed to operate the site reliably, improve projects, and provide advertising or analytics when necessary. ERBELLO does not operate this site for the purpose of unnecessarily collecting or selling visitor information.`,
        infoTitle:'PRIVACY.INFO',
        blocks:[
          {title:'Information used', text:`Information used on this site is limited to what is needed for basic site operation. This may include visited pages, project view counts, error status, browser or device environment, and similar information used to confirm that the site works properly.

When the owner adds or edits projects, titles, descriptions, tags, images, code, and contact links may be stored for site operation. These items may appear on project cards, detail pages, contact pages, and related areas.

General visitors can use the site without creating an account. However, entering sensitive information such as personal data, passwords, payment information, or national identification numbers while using projects is not recommended. If you move to another service through an external link, that external service's privacy policy applies.`},
          {title:'Ads and cookies', text:`This site may use advertising services such as Google AdSense for operation. When ads are displayed, Google or third-party ad providers may use cookies to serve ads, measure ad performance, or prevent invalid clicks.

Cookies are small pieces of information stored in a visitor's browser. They may be used for ad delivery, analytics, duplicate ad prevention, and security checks. Visitors can restrict or delete cookies through browser settings, and they can manage personalized ad settings through Google's ad settings.

I try to adjust ads so they do not excessively interfere with site use. Ads are restricted in areas where they are not appropriate, such as project run screens, owner screens, and private project lock screens.`},
          {title:'Retention and deletion', text:`Information stored for site operation may be kept for as long as needed. Project data, view counts, page text, contact links, and similar information may remain until the site owner edits or deletes them.

Unnecessary information may be organized or deleted during operation. Some information may also be changed or removed due to site structure changes, project deletion, service migration, or storage management.

If a visitor contacts through an external link or moves to another service, information processed by that external service is not directly managed by this site. For privacy questions or deletion requests, please use the links registered on the contact page.`},
          {title:'Contact', text:`If you have questions about this Privacy Policy or need to ask about privacy while using the site, you can contact me through the links on the contact page.

Because this site is a personally operated project gallery, I will review inquiries and take necessary action within a reasonable scope. However, data processed after moving to an external service, or data handled independently by an advertising platform, follows that service's own policy.

This Privacy Policy may be updated according to changes in site operation, ad settings, or features. When changes are made, they will be reflected by updating this page.`}
        ]
      },
      terms: {
        eyebrow:'TERMS',
        title:'Terms of Use',
        body:`This site is a gallery for organizing and sharing personal projects made under the activity name ERBELLO. Visitors can browse public projects and use each project's detail page and run page.

The projects posted here are created for personal learning, experiments, and records rather than as professional services or commercial tools. Some features may be strongly experimental, and they may not work normally or may appear differently depending on the user's environment.

By using this site, you are considered to agree to the guidance below. The site structure, features, project list, links, and policy text may be changed or deleted depending on operation needs.`,
        infoTitle:'TERMS.INFO',
        blocks:[
          {title:'Personal project gallery', text:`This site is a personal project gallery that organizes completed HTML pages, React/JSX artifacts, small games, and tools. Each project is made for learning, experimentation, personal use, and sharing, and not every project guarantees professional quality or complete stability.

Visitors can run public projects directly, but using them for important work or sensitive information processing is not recommended. Tools such as calculators, converters, and generators are provided for reference, and their accuracy or fitness for a particular purpose is not guaranteed.

Private projects and draft projects may have access restricted according to the owner's settings. Visibility status, project structure, links, and descriptions may change at the owner's discretion.`},
          {title:'Content use', text:`Projects, descriptions, images, designs, code structures, and other content registered on this site are, unless otherwise stated, works created or organized by the operator under the activity name ERBELLO. Visitors may browse the site and use it for personal purposes, but unauthorized copying, redistribution, commercial use, and reposting without attribution are not recommended.

Some projects may be fan-made, unofficial tools, or personal experiments. Even if a project references a certain game, character, service, or brand, this does not mean it is directly related to the official service or rights holder.

If there are concerns about copyright, trademarks, portrait rights, or other external rights, you can contact me through the contact page. I will review the matter and consider necessary action within a reasonable scope.`},
          {title:'Visitor precautions', text:`Visitors must not use this site's projects for illegal purposes, to infringe on others' rights, or in ways that place excessive burden on the service. Entering personal information, passwords, payment information, or sensitive files into project run screens is not recommended.

Some projects are mini tools that run in the browser, so results may vary depending on the user's device environment, browser version, and network condition. When using file conversion, code generation, calculation, or similar features, important results should always be checked again.

If you move to an external link while using the site, the terms and privacy policy of that external site apply. Problems that occur on external sites follow the policies of those services.`},
          {title:'Limitation of responsibility', text:`This site is a personally operated project gallery, and I try to provide the site and projects as reliably as possible within a reasonable scope. However, I do not guarantee that every function will always work without errors, look the same in every environment, or be fully suitable for a specific purpose.

The operator cannot take full responsibility for every issue that may arise from project use, such as data loss, calculation errors, conversion result errors, problems with external links, or user input mistakes. For important work or sensitive information, separate review and backup are recommended.

The site may be changed, suspended, moved, or deleted without prior notice, and project visibility may also be changed at the owner's discretion.`},
          {title:'Ads and external services', text:`This site may use advertising services such as Google AdSense for operation. Ads may be shown to help support site operation costs, and the external sites linked from ads are not directly managed by this site.

When visitors click ads or external links and move to another site, that site's policies and terms apply. This site is not directly responsible for the content, products, services, or privacy practices of external sites.

I try to adjust ad placement and display so they do not excessively interfere with site use, and I restrict ads in areas where they are not appropriate, such as project run screens and owner screens.`},
          {title:'Service changes', text:`The site structure, project list, links, design, features, and policy text may be changed or deleted depending on operation needs. New projects may be added, and existing projects may be changed to private or draft status.

Some features may change due to site improvements, security issues, storage management, external service policy changes, or advertising policy response. Changes are reflected on the site, and related pages may be updated when necessary.

By continuing to use the site, visitors are considered to agree to the changed content. If important changes are made, I will update the related page content within a reasonable scope.`}
        ]
      }
    },
    ja: {
      about: {
        eyebrow:'ABOUT',
        title:'ERBELLOのプロジェクトギャラリー',
        body:`ここは、ERBELLOという活動名で制作している小さなWebプロジェクトをまとめた個人ギャラリーです。完成したHTMLページ、React/JSXアーティファクト、ミニゲーム、生活に使える小さなツール、デザイン関連ページなど、実際に開いて使える作品を一つずつ整理しています。

専門開発者の公式ポートフォリオというよりは、一人で学びながら作ってきたものを積み重ねていく個人アーカイブに近い場所です。まだ足りない部分やぎこちない部分もありますが、思いついたアイデアを実際に押して動かせる形で残したくて、この空間を作りました。

訪問してくださった方が必要なツールを見つけたり、少しだけ楽しめる小さなページを見つけたり、「こういう形でもWebプロジェクトを作れるんだ」と気軽に眺めてもらえたら嬉しいです。すべてのプロジェクトが完璧ではありませんが、少しずつ直し、整え、更新していくつもりです。どうぞよろしくお願いします!!`,
        infoTitle:'ABOUT.INFO',
        blocks:[
          {title:'プロジェクトとは？', text:`ここに掲載されるプロジェクトは、AIの助けを借りながら独学で制作している個人作品です。最初から専門的な開発知識を持って始めたわけではないため、機能や構造が完璧ではない場合があり、実験的な形のまま残っている部分もあります。

それでも、アイデアだけで終わらせず、実際に開いて使えるWebページの形にしてみることを目標にしています。あるプロジェクトは生活に役立つツールであり、あるプロジェクトは短く遊べるゲームであり、またあるプロジェクトはデザインや記録のための小さな実験に近いものです。

足りない部分やぎこちなさがあっても、誰かに少しでも役立ったり、楽しい見どころになったりすれば嬉しいです。このギャラリーは完成した成果物だけを集める場所ではなく、学び、作り、直していく過程も一緒に残しておく空間です。`},
          {title:'活動名 ERBELLO', text:`ERBELLOは、私が個人制作や活動で使っている活動名です。最初はNaverブログでさまざまな記録や制作物を残し始め、現在は主にTwitterでイラスト、アイデア、小さな制作物を共有しながら活動しています。

絵や音楽のように自分で表現する作業が好きで、最近はHTMLページや簡単なWebアプリのように、ユーザーが直接クリックして体験できる形の制作にも関心を持っています。開発はまだゆっくり学んでいる途中なので、完璧な技術的完成度よりも、自分が使ってみたいものや誰かの役に立つかもしれない小さな機能を作ることに集中しています。

このサイトは、その過程で生まれた成果物を整理しておく場所です。ERBELLOという名前で作ったさまざまな作品を一か所にまとめ、必要なときにまた見返せるようにし、訪問者の方にも気軽に見てもらえるように運営しています。`},
          {title:'活動計画', text:`新しい作品ができたら、このギャラリーに少しずつ追加していく予定です。生活に役立つ小さなツール、短く楽しめるミニゲーム、デザインや記録に使えるページなど、気軽に開けるプロジェクトを中心に作っていきたいと思っています。

精密で難しいサービスを一度に作るのは簡単ではありませんが、小さな機能でも実際に使える形で完成させることを目標にしています。すでに公開しているプロジェクトもそのままにせず、必要に応じて説明を補足したり、デザインを直したり、機能を少しずつ改善していくつもりです。

このギャラリーはERBELLOの作品を見せる場所であると同時に、私が学び、試してきたことを残す記録でもあります。軽く作ったプロジェクトでも誰かの役に立てたら嬉しいですし、これからもゆっくり新しい作品を追加していきます。`}
        ]
      },
      privacy: {
        eyebrow:'PRIVACY',
        title:'プライバシーポリシー',
        body:`このサイトは、ERBELLOという活動名で運営している個人プロジェクトギャラリーです。訪問者が公開プロジェクトを閲覧し、詳細ページを確認し、一部のツールやゲームを実行できるように構成されています。

このサイトは会員登録を求めず、一般の訪問者がプロジェクトを見る過程で、氏名、住所、電話番号のような直接的な個人情報を意図的に求めることはありません。ただし、サイト運営、セキュリティ確認、プロジェクト閲覧数の記録、エラー確認、広告提供などの基本機能のために、一部の技術的情報が使用される場合があります。

収集または使用される可能性のある情報は、サイトを安定して運営し、プロジェクトを改善し、必要に応じて広告や統計機能を提供するための範囲に限られます。ERBELLOは、訪問者の情報を不要に収集したり販売したりすることを目的としていません。`,
        infoTitle:'PRIVACY.INFO',
        blocks:[
          {title:'使用される情報', text:`このサイトで使用される可能性のある情報は、基本的なサイト運営に必要な情報に限られます。たとえば、訪問したページ、プロジェクトの閲覧数、エラー発生の有無、ブラウザや端末環境など、サイトが正常に動作しているか確認するための情報が含まれる場合があります。

管理者がプロジェクトを追加または編集するときに入力したタイトル、説明、タグ、画像、コード、連絡先リンクなどは、サイト運営のために保存されます。これらの情報は、プロジェクトカード、詳細ページ、連絡先ページなどに表示される場合があります。

一般の訪問者は、別途アカウントを作成せずにサイトを利用できます。ただし、プロジェクト利用中に個人情報、パスワード、決済情報、身分証番号のような機密情報を入力することは推奨しません。外部リンクを通じて別のサービスへ移動した場合は、その外部サービスのプライバシーポリシーが適用されます。`},
          {title:'広告とCookie', text:`このサイトは運営のためにGoogle AdSenseなどの広告サービスを使用する場合があります。広告が表示される場合、Googleまたは第三者の広告提供者が、広告配信、広告成果の測定、不正クリック防止のためにCookieを使用することがあります。

Cookieは訪問者のブラウザに保存される小さな情報であり、広告配信、統計分析、重複広告の防止、セキュリティ確認などに使用される場合があります。訪問者はブラウザ設定からCookieの保存を制限または削除でき、Googleの広告設定からパーソナライズ広告に関する設定を管理できます。

広告はサイト利用を過度に妨げないように調整するよう努めます。プロジェクト実行画面、管理者画面、非公開プロジェクトのロック画面のように広告が適切でない領域では、広告を制限する方針で運営します。`},
          {title:'保管と削除', text:`サイト運営のために保存された情報は、必要な期間保管される場合があります。プロジェクトデータ、閲覧数、ページ文言、連絡先リンクなどは、サイト運営者が直接編集または削除するまで維持される場合があります。

不要な情報は運営過程で整理または削除されることがあります。サイト構造の変更、プロジェクト削除、サービス移転、保存容量管理などの理由により、一部の情報が変更または削除される場合もあります。

訪問者が外部リンクを通じて問い合わせをしたり、別のサービスへ移動した場合、その外部サービスで処理される情報はこのサイトが直接管理しません。個人情報に関する問い合わせや削除依頼が必要な場合は、連絡先ページに登録されたリンクから問い合わせることができます。`},
          {title:'お問い合わせ', text:`プライバシーポリシーに関して気になる点がある場合や、サイト利用中に個人情報に関する問い合わせが必要な場合は、連絡先ページに登録されたリンクから問い合わせることができます。

このサイトは個人が運営するプロジェクトギャラリーであるため、可能な範囲で問い合わせ内容を確認し、必要な対応を行います。ただし、外部サービスへ移動した後に発生する情報処理や、広告プラットフォームが独自に処理するデータについては、そのサービスのポリシーに従います。

本プライバシーポリシーは、サイトの運営方式、広告設定、機能変更に応じて修正される場合があります。変更がある場合は、このページの内容を更新する形で案内します。`}
        ]
      },
      terms: {
        eyebrow:'TERMS',
        title:'利用規約',
        body:`このサイトは、ERBELLOという活動名で制作した個人プロジェクトを整理し共有するためのギャラリーです。訪問者は公開されたプロジェクトを閲覧し、各プロジェクトの詳細ページと実行ページを利用できます。

ここに掲載されているプロジェクトは、専門サービスや商用ツールというよりも、個人の学習、実験、記録を目的として制作されたものです。一部の機能はテスト的な性格が強い場合があり、利用環境によって正常に動作しなかったり、画面表示が異なったりすることがあります。

このサイトを利用する場合、以下の案内事項に同意したものとみなします。サイトの構造、機能、プロジェクト一覧、リンク、ポリシー文言は、運営状況に応じて修正または削除される場合があります。`,
        infoTitle:'TERMS.INFO',
        blocks:[
          {title:'個人プロジェクトギャラリー', text:`このサイトは、完成したHTMLページ、React/JSXアーティファクト、小さなゲームやツールを整理しておく個人プロジェクトギャラリーです。各プロジェクトは学習、実験、個人利用、共有を目的として作られており、すべてのプロジェクトが専門的な品質や完全な安定性を保証するものではありません。

訪問者は公開されたプロジェクトを直接実行できますが、重要な業務や機密情報の処理を目的として使用することは推奨しません。計算機、変換機、生成機などのツールは参考用として提供され、結果の正確性や特定目的への適合性を保証しません。

非公開プロジェクトや下書きプロジェクトは、運営者の設定によりアクセスが制限される場合があります。公開状態、プロジェクト構成、リンク、説明文は、運営者の判断により変更されることがあります。`},
          {title:'コンテンツ利用', text:`このサイトに登録されたプロジェクト、説明、画像、デザイン、コード構成などは、別途表示がない限り、ERBELLOという活動名で運営者が制作または整理したものです。訪問者はサイトを閲覧し個人的な用途で利用できますが、無断複製、再配布、商用利用、出典を消した再投稿などは推奨しません。

一部のプロジェクトは、ファンメイド、非公式ツール、個人実験物の性格を持つ場合があります。特定のゲーム、キャラクター、サービス、ブランドを参考にするプロジェクトがあっても、公式サービスや権利者と直接関係があることを意味しません。

外部の著作権、商標権、肖像権などの権利問題が懸念される場合は、連絡先ページから問い合わせることができます。確認後、可能な範囲で必要な対応を検討します。`},
          {title:'利用上の注意', text:`訪問者は、このサイトのプロジェクトを違法な目的、他者の権利を侵害する目的、またはサービスに過度な負荷をかける方法で利用してはいけません。プロジェクト実行画面に個人情報、パスワード、決済情報、機密ファイルなどを入力することは推奨しません。

一部のプロジェクトはブラウザ内で動作するミニツールであるため、利用者の端末環境、ブラウザバージョン、ネットワーク状態により結果が異なる場合があります。ファイル変換、コード生成、計算機能などを使用する際は、重要な結果を必ず再確認することをおすすめします。

サイト利用中に外部リンクへ移動する場合、その外部サイトの規約とプライバシーポリシーが適用されます。外部サイトで発生する問題は、そのサービスの運営方針に従います。`},
          {title:'責任の制限', text:`このサイトは個人が運営するプロジェクトギャラリーであり、サイトとプロジェクトを可能な範囲で安定して提供するよう努めます。ただし、すべての機能が常にエラーなく動作すること、すべての環境で同じように表示されること、特定の目的に完全に適していることを保証するものではありません。

プロジェクト利用により発生する可能性のあるデータ損失、計算ミス、変換結果の誤り、外部リンク利用上の問題、利用者の入力ミスなどについて、運営者がすべての責任を負うことは困難です。重要な作業や機密情報に関わる場合は、別途確認とバックアップをおすすめします。

サイトは予告なく修正、中断、移転、削除される場合があり、プロジェクトごとの公開状態も運営者の判断により変更されることがあります。`},
          {title:'広告と外部サービス', text:`このサイトは運営のためにGoogle AdSenseなどの広告サービスを使用する場合があります。広告はサイト運営費を補助する目的で表示されることがあり、広告の内容やリンク先の外部サイトはこのサイトが直接管理するものではありません。

訪問者が広告や外部リンクをクリックして別のサイトへ移動した場合、そのサイトのポリシーと規約が適用されます。このサイトは外部サイトのコンテンツ、商品、サービス、個人情報の処理方法について直接責任を負いません。

広告がサイト利用を過度に妨げないよう、位置や表示方法を調整するよう努めます。プロジェクト実行画面や管理者画面のように適切でない領域では、広告を制限する方針で運営します。`},
          {title:'サービス変更', text:`このサイトの構造、プロジェクト一覧、リンク、デザイン、機能、ポリシー文言は、運営状況に応じて修正または削除される場合があります。新しいプロジェクトが追加されることもあり、既存のプロジェクトが非公開または下書き状態に変更されることもあります。

サイト改善、セキュリティ問題、保存容量管理、外部サービスのポリシー変更、広告ポリシー対応などの理由により、一部の機能が変わる場合があります。変更事項はサイトに反映される形で案内され、必要に応じて関連ページの内容を修正することがあります。

利用者はサイトを継続して利用することで、変更後の内容に同意したものとみなされます。重要な変更がある場合は、可能な範囲でページ内容を更新して案内します。`}
        ]
      }
    },
    zh: {
      about: {
        eyebrow:'ABOUT',
        title:'ERBELLO 的项目画廊',
        body:`这里是一个个人画廊，用来整理我以 ERBELLO 这一活动名制作的小型网页项目。这里会逐一收集可以直接打开和使用的作品，例如完整的 HTML 页面、React/JSX 作品、小型游戏、生活工具，以及和设计相关的页面。

与其说这是专业开发者的正式作品集，不如说它更像是我一边独自学习一边制作、慢慢积累起来的个人档案。里面可能还有不足或不够自然的地方，但我希望把想到的点子保存成真正可以点击、打开、运行的形式，所以做了这个空间。

希望来访的人能在这里找到有用的小工具，短暂地玩一玩某个小页面，或者轻松地看看“原来网页项目也可以这样制作”。不是每个项目都完美，但我会慢慢修正、打磨，并一点点更新。请多多关照!!`,
        infoTitle:'ABOUT.INFO',
        blocks:[
          {title:'这些项目是什么？', text:`这里发布的项目，是我借助 AI 的帮助、通过自学独自制作的个人作品。因为一开始并不是以专业开发知识作为基础，所以功能或结构可能并不完美，有些部分也可能保留着实验性的样子。

即便如此，我的目标不是让想法只停留在脑海里，而是把它们做成可以实际打开和使用的网页。有的项目是生活中能派上用场的小工具，有的是可以短暂游玩的小游戏，也有的是用于设计或记录的小实验。

即使有不足和不成熟的地方，如果它们能给某个人带来一点帮助，或者成为有趣的浏览内容，我就会很开心。这个画廊不只是收集完成品的地方，也是记录学习、制作、修改过程的空间。`},
          {title:'活动名 ERBELLO', text:`ERBELLO 是我在个人创作和活动中使用的活动名。一开始我通过 Naver 博客留下各种记录和作品，现在主要在 Twitter 上分享绘画、想法和小型制作物。

我喜欢绘画和音乐这类可以直接表达自己的创作，最近也对 HTML 页面、简单网页应用这类用户可以亲自点击和体验的作品感兴趣。开发方面我还在慢慢学习，所以相比追求完美的技术完成度，我更专注于制作自己想使用、或者也许能帮到别人的小功能。

这个网站就是用来整理这些过程中产生的结果的空间。它把我以 ERBELLO 这个名字制作的各种作品集中在一个地方，方便以后重新查看，也让访问者可以轻松浏览。`},
          {title:'活动计划', text:`如果有新的作品，我会慢慢把它们添加到这个画廊里。未来想主要制作一些可以轻松打开的项目，例如生活中能用到的小工具、短时间能玩的小游戏，以及用于设计或记录的页面。

一次性做出精密又复杂的服务并不容易，但我希望即使只是很小的功能，也能完成到实际可用的程度。已经发布的项目也不会完全放着不管，之后会根据需要补充说明、调整设计，并逐步改进功能。

这个画廊既是展示 ERBELLO 作品的空间，也是记录我学习和尝试的过程。哪怕是轻松制作的小项目，如果能对某个人有一点帮助就很好。今后我也会慢慢添加新的作品。`}
        ]
      },
      privacy: {
        eyebrow:'PRIVACY',
        title:'隐私政策',
        body:`本网站是以 ERBELLO 这一活动名运营的个人项目画廊。网站用于让访问者浏览公开项目、查看详细页面，并运行部分工具或游戏。

本网站不要求会员注册，也不会在普通访问者浏览项目的过程中，主动要求提供姓名、地址、电话号码等直接个人信息。不过，为了网站运营、安全确认、项目浏览量记录、错误检查、广告提供等基本功能，可能会使用一部分技术信息。

可能被收集或使用的信息，仅限于稳定运营网站、改进项目，并在需要时提供广告和统计功能的范围。ERBELLO 不以不必要地收集或出售访问者信息为目的。`,
        infoTitle:'PRIVACY.INFO',
        blocks:[
          {title:'使用的信息', text:`本网站可能使用的信息，仅限于基本网站运营所需的信息。例如访问过的页面、项目浏览量、是否发生错误、浏览器或设备环境等，用于确认网站是否正常运行的信息。

管理员添加或修改项目时输入的标题、说明、标签、图片、代码、联系方式链接等，会为了网站运营而被保存。这些信息可能会显示在项目卡片、详细页面、联系方式页面等位置。

普通访问者无需创建账号即可使用本网站。不过，在使用项目时，不建议输入个人信息、密码、付款信息、身份证件号码等敏感信息。如果通过外部链接跳转到其他服务，则适用该外部服务的隐私政策。`},
          {title:'广告和 Cookie', text:`本网站可能会为了运营而使用 Google AdSense 等广告服务。显示广告时，Google 或第三方广告提供商可能会使用 Cookie 来投放广告、衡量广告效果，或防止无效点击。

Cookie 是保存在访问者浏览器中的小型信息，可能用于广告投放、统计分析、防止重复广告、安全确认等。访问者可以通过浏览器设置限制或删除 Cookie，也可以通过 Google 的广告设置管理个性化广告相关选项。

我会尽量调整广告，避免它们过度影响网站使用。在项目运行页面、管理员页面、私密项目锁定页面等不适合显示广告的区域，会以限制广告为原则进行运营。`},
          {title:'保留和删除', text:`为了网站运营而保存的信息，可能会在需要期间保留。项目数据、浏览量、页面文案、联系方式链接等，可能会一直保留到网站运营者直接修改或删除为止。

不再需要的信息可能会在运营过程中被整理或删除。由于网站结构调整、项目删除、服务迁移、存储空间管理等原因，部分信息也可能被修改或移除。

如果访问者通过外部链接进行联系，或跳转到其他服务，该外部服务处理的信息不由本网站直接管理。如需提出与个人信息相关的咨询或删除请求，可以通过联系方式页面中登记的链接进行联系。`},
          {title:'联系', text:`如果对本隐私政策有疑问，或在使用网站时需要进行隐私相关咨询，可以通过联系方式页面中登记的链接联系。

本网站是个人运营的项目画廊，因此我会在可行范围内确认咨询内容并采取必要措施。但是，跳转到外部服务后发生的信息处理，或广告平台自行处理的数据，适用相应服务的政策。

本隐私政策可能会根据网站运营方式、广告设置、功能变更而修改。如有变更，将通过更新本页面内容的方式进行说明。`}
        ]
      },
      terms: {
        eyebrow:'TERMS',
        title:'使用条款',
        body:`本网站是为了整理和分享以 ERBELLO 这一活动名制作的个人项目而建立的画廊。访问者可以浏览公开项目，并使用各项目的详细页面和运行页面。

这里发布的项目并非专业服务或商业工具，而是以个人学习、实验和记录为目的制作的作品。部分功能可能具有较强的测试性质，可能会因使用环境不同而无法正常运行，或显示效果有所差异。

使用本网站即视为同意以下说明。网站结构、功能、项目列表、链接、政策文案等，可能会根据运营情况进行修改或删除。`,
        infoTitle:'TERMS.INFO',
        blocks:[
          {title:'个人项目画廊', text:`本网站是用于整理完整 HTML 页面、React/JSX 作品、小型游戏和工具的个人项目画廊。每个项目都以学习、实验、个人使用和分享为目的制作，并不保证所有项目都具有专业品质或完全稳定性。

访问者可以直接运行公开项目，但不建议将其用于重要业务或敏感信息处理。计算器、转换器、生成器等工具仅作为参考提供，不保证结果的准确性或适用于特定目的。

私密项目或草稿项目可能会根据运营者的设置限制访问。公开状态、项目结构、链接、说明文字等，可能会根据运营者判断进行变更。`},
          {title:'内容使用', text:`本网站中登记的项目、说明、图片、设计、代码结构等，除非另有标注，均为运营者以 ERBELLO 这一活动名制作或整理的作品。访问者可以浏览网站并用于个人用途，但不建议未经许可复制、再分发、商业使用，或删除来源后重新发布。

部分项目可能具有粉丝制作、非官方工具、个人实验作品的性质。即使某个项目参考了特定游戏、角色、服务或品牌，也不意味着它与官方服务或权利人有直接关系。

如果担心外部版权、商标权、肖像权等权利问题，可以通过联系方式页面进行咨询。确认后，我会在可行范围内考虑必要措施。`},
          {title:'用户注意事项', text:`访问者不得以违法目的、侵犯他人权利的目的，或对服务造成过度负担的方式使用本网站项目。不建议在项目运行页面输入个人信息、密码、付款信息、敏感文件等。

部分项目是在浏览器中运行的小型工具，因此结果可能会受到用户设备环境、浏览器版本、网络状态的影响。使用文件转换、代码生成、计算功能等时，重要结果应务必再次确认。

在使用网站过程中跳转到外部链接时，适用该外部网站的条款和隐私政策。外部网站上发生的问题，遵循该服务的运营政策。`},
          {title:'责任限制', text:`本网站是个人运营的项目画廊，网站和项目会尽可能在可行范围内稳定提供。但并不保证所有功能始终无错误运行、在所有环境中显示完全相同，或完全适合某一特定目的。

对于因使用项目可能产生的数据丢失、计算错误、转换结果错误、外部链接使用问题、用户输入失误等，运营者难以承担全部责任。涉及重要工作或敏感信息时，建议另行确认并做好备份。

本网站可能在没有事先通知的情况下被修改、中断、迁移或删除，各项目的公开状态也可能根据运营者判断发生变化。`},
          {title:'广告和外部服务', text:`本网站可能会为了运营而使用 Google AdSense 等广告服务。广告可能会作为辅助网站运营费用的方式显示，广告内容及其连接的外部网站不由本网站直接管理。

访问者点击广告或外部链接跳转到其他网站时，适用该网站的政策和条款。本网站不对外部网站的内容、商品、服务或个人信息处理方式承担直接责任。

我会尽量调整广告位置和展示方式，避免广告过度影响网站使用。在项目运行页面、管理员页面等不适合显示广告的区域，会以限制广告为原则进行运营。`},
          {title:'服务变更', text:`本网站的结构、项目列表、链接、设计、功能、政策文案等，可能会根据运营情况进行修改或删除。可能会添加新项目，也可能会将现有项目改为私密或草稿状态。

由于网站改进、安全问题、存储空间管理、外部服务政策变更、广告政策应对等原因，部分功能可能会发生变化。变更事项会以反映到网站上的方式进行说明，必要时也会修改相关页面内容。

访问者继续使用本网站，即视为同意变更后的内容。如有重要变更，将在可行范围内更新页面内容进行说明。`}
        ]
      }
    }
  };

  function richDefaultPage(slug, lang) {
    const set = PAGE_CONTENT_DEFAULTS[lang] || PAGE_CONTENT_DEFAULTS.ko;
    return set && set[slug] ? clone(set[slug]) : null;
  }

  function mergePage(base, override) {
    const source = override && typeof override === 'object' ? override : {};
    const merged = { ...base, ...source };
    merged.blocks = Array.isArray(source.blocks) ? source.blocks : (Array.isArray(base.blocks) ? base.blocks : []);
    merged.links = Array.isArray(source.links) ? source.links : (Array.isArray(base.links) ? base.links : []);
    return merged;
  }

  function pageContent(slug = currentRoute, lang = currentLang) {
    const defaults = (I18N[lang] || I18N.ko).defaultPages || I18N.ko.defaultPages;
    const fallbackDefaults = I18N.ko.defaultPages || {};
    const base = clone(richDefaultPage(slug, lang) || defaults[slug] || policyDefaultPage(slug, lang) || routeDefaultPage(slug, lang) || richDefaultPage(slug, 'ko') || fallbackDefaults[slug] || policyDefaultPage(slug, 'ko') || routeDefaultPage(slug, 'ko') || {});
    const row = pageRows.find(item => item.slug === slug && item.lang === lang);
    return mergePage(base, row && row.content);
  }

  function parseHomeDisplayTitle(value) {
    const raw = String(value || '').trim();
    const fallback = { main:'ERBELLO', sub:'GALLERY', aria:'ERBELLO Gallery', isBrand:true };
    if (!raw) return fallback;
    const parts = raw.includes('|') ? raw.split('|').map(part => part.trim()).filter(Boolean) : raw.split(/\n+/).map(part => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const aria = parts.join(' ') || fallback.aria;
      return { main:parts[0] || fallback.main, sub:parts[1] || fallback.sub, aria, isBrand:/erbello/i.test(aria) && /gallery/i.test(aria) };
    }
    if (/erbello/i.test(raw) && /gallery/i.test(raw)) return { main:'ERBELLO', sub:'GALLERY', aria:raw, isBrand:true };
    return { main:raw, sub:'', aria:raw, isBrand:false };
  }

  function fmtDate(value) {
    if (!value) return tr('noDate');
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return tr('noDate');
    return new Intl.DateTimeFormat(LOCALE[currentLang] || 'ko-KR', { year:'numeric', month:'short', day:'numeric' }).format(d);
  }

  function fmtMonth(value) {
    if (!value) return tr('noDate');
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return tr('noDate');
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function ensureHeadTag(selector, html) {
    let node = document.querySelector(selector);
    if (!node) {
      const template = document.createElement('template');
      template.innerHTML = html;
      node = template.content.firstElementChild;
      if (node) document.head.appendChild(node);
    }
    return node;
  }

  function setMeta(selector, html, attr, value) {
    const node = ensureHeadTag(selector, html);
    if (node) node.setAttribute(attr, value);
  }

  function routeSeo(route = currentRoute) {
    const page = pageContent(route);
    const path = pageUrl(route);
    const titleText = page.title || tr('pageTitle');
    const title = route === 'home' ? tr('pageTitle') : `${titleText} · ERBELLO`;
    const description = compact(page.body || tr('metaDescription'), 160);
    return { title, description, url:`${SITE_ORIGIN}${path}`, image:`${SITE_ORIGIN}/assets/illust/erbello-typo5.png` };
  }

  function updateRouteMeta() {
    const seo = routeSeo(currentRoute);
    document.title = seo.title;
    setMeta('meta[name="description"]', '<meta name="description">', 'content', seo.description);
    setMeta('link[rel="canonical"]', '<link rel="canonical">', 'href', seo.url);
    setMeta('meta[property="og:title"]', '<meta property="og:title">', 'content', seo.title);
    setMeta('meta[property="og:description"]', '<meta property="og:description">', 'content', seo.description);
    setMeta('meta[property="og:url"]', '<meta property="og:url">', 'content', seo.url);
    setMeta('meta[property="og:image"]', '<meta property="og:image">', 'content', seo.image);
    setMeta('meta[name="twitter:title"]', '<meta name="twitter:title">', 'content', seo.title);
    setMeta('meta[name="twitter:description"]', '<meta name="twitter:description">', 'content', seo.description);
    setMeta('meta[name="twitter:image"]', '<meta name="twitter:image">', 'content', seo.image);
  }

  function toast(message) {
    const node = $('toast');
    if (!node) return;
    node.textContent = String(message || '');
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 2400);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    toast(tr('copied'));
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers:{ 'Content-Type':'application/json', ...(options.headers || {}) } });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = { error:text }; }
    if (!response.ok) {
      const fallback = response.status === 413 ? tr('zipTooLarge') : `Request failed: ${response.status}`;
      throw new Error((data && data.error) || fallback);
    }
    return data;
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B','KB','MB','GB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  function uploadMime(file) {
    if (!file) return 'application/octet-stream';
    if (file.type) return file.type;
    const name = String(file.name || '').toLowerCase();
    if (/\.html?$/.test(name)) return 'text/html';
    if (/\.jsx?$/.test(name)) return 'text/javascript';
    if (/\.tsx?$/.test(name)) return 'text/typescript';
    if (/\.zip$/.test(name)) return 'application/zip';
    return 'application/octet-stream';
  }

  async function uploadFileToStorage(kind, file) {
    if (!file) return null;
    const signed = await api('/api/admin/uploads/sign', {
      method:'POST',
      headers:{ 'x-admin-token':adminToken },
      body:JSON.stringify({ kind, name:file.name || `${kind}-upload`, mime:uploadMime(file), size:file.size || 0 })
    });
    const upload = await fetch(signed.signedUrl, {
      method:'PUT',
      headers:{ 'Content-Type': uploadMime(file) },
      body:file
    });
    if (!upload.ok) {
      const text = await upload.text().catch(() => '');
      const tooLarge = upload.status === 413 || /payload too large|exceeded|max/i.test(text);
      throw new Error(tooLarge ? `${tr('zipTooLarge')} (${file.name || 'file'}, ${formatBytes(file.size)})` : (text || `Upload failed: ${upload.status}`));
    }
    return signed;
  }

  function normalizeZipPath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/\.\//g, '/');
  }

  function zipBaseDir(path) {
    const clean = normalizeZipPath(path);
    return clean.includes('/') ? clean.split('/').slice(0, -1).join('/') : '';
  }

  function ignoredZipEntry(entry) {
    const name = normalizeZipPath(entry && entry.name);
    return !name || entry.dir || /^__MACOSX\//i.test(name) || /(^|\/)\.DS_Store$/i.test(name);
  }

  function zipIndexRank(name) {
    const clean = normalizeZipPath(name).toLowerCase();
    const ranks = ['index.html', 'dist/index.html', 'build/index.html', 'public/index.html'];
    const exact = ranks.indexOf(clean);
    if (exact !== -1) return exact;
    if (/(^|\/)index\.html?$/.test(clean)) return 10 + clean.split('/').length;
    if (/\.html?$/.test(clean)) return 100 + clean.length;
    return 9999;
  }

  function findZipIndexEntry(entries) {
    return [...entries].filter(entry => /(^|\/)index\.html?$/i.test(entry.name) || /\.html?$/i.test(entry.name)).sort((a, b) => zipIndexRank(a.name) - zipIndexRank(b.name))[0] || null;
  }

  function loadScriptOnce(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => script.src === src);
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once:true });
        existing.addEventListener('error', () => reject(new Error(tr('zipUnsupported'))), { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(tr('zipUnsupported')));
      document.head.appendChild(script);
    });
  }

  async function ensureJsZip() {
    if (window.JSZip) return window.JSZip;
    await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip');
    if (!window.JSZip) throw new Error(tr('zipUnsupported'));
    return window.JSZip;
  }

  async function readZipEntries(file) {
    const JSZip = await ensureJsZip();
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter(entry => !ignoredZipEntry(entry));
    return { zip, entries, index: findZipIndexEntry(entries) };
  }

  async function inspectZipFile(file) {
    if (!file) return null;
    const { entries, index } = await readZipEntries(file);
    if (!index) throw new Error(tr('zipNoIndex'));
    const large = entries.filter(entry => Number(entry._data && entry._data.uncompressedSize || entry._data && entry._data.compressedSize || 0) > ZIP_ENTRY_LIMIT)
      .map(entry => `${normalizeZipPath(entry.name)} (${formatBytes(entry._data && (entry._data.uncompressedSize || entry._data.compressedSize))})`);
    if (large.length) throw new Error(`${tr('zipEntryTooLarge')} ${large.slice(0, 4).join(', ')}`);
    const browserWarning = file.size > ZIP_BROWSER_WARN_LIMIT ? `${tr('zipBrowserLarge')} (${formatBytes(file.size)})` : '';
    return { count: entries.length, index: normalizeZipPath(index.name), root: zipBaseDir(index.name), size: file.size, browserWarning };
  }

  async function getSystemStatusCached(force = false) {
    if (!force && systemStatusCache) return systemStatusCache;
    systemStatusCache = await api('/api/admin/system', { headers:{ 'x-admin-token':adminToken } });
    return systemStatusCache;
  }

  async function assertZipStorageReady() {
    const status = await getSystemStatusCached(true);
    const ok = status && status.mode === 'supabase' && status.storageOk && status.artifactBucketOk && status.storageUploadOk;
    if (!ok) {
      const reason = [
        !status || status.mode !== 'supabase' ? 'Supabase 환경변수 없음' : '',
        status && !status.artifactBucketOk ? `${status.artifactBucket || 'artifact'} bucket 없음` : '',
        status && !status.storageUploadOk ? (status.storageUploadError || 'Storage upload check failed') : ''
      ].filter(Boolean).join(' · ');
      throw new Error(`${tr('zipStorageNotReady')} ${reason}`);
    }
    return status;
  }

  async function uploadZipAsManifest(file) {
    if (!file) return null;
    toast(tr('zipUploadCheck'));
    await assertZipStorageReady();
    const info = await inspectZipFile(file);
    if (info && info.browserWarning) toast(info.browserWarning);
    toast(tr('zipUploadExtract'));
    const { entries, index } = await readZipEntries(file);
    const files = [];
    let done = 0;
    for (const entry of entries) {
      const zipPath = normalizeZipPath(entry.name);
      const blob = await entry.async('blob');
      if (blob.size > ZIP_ENTRY_LIMIT) throw new Error(`${tr('zipEntryTooLarge')} ${zipPath} (${formatBytes(blob.size)})`);
      toast(`${tr('zipUploadFiles')} ${done + 1}/${entries.length}`);
      const uploadFile = new File([blob], zipPath.split('/').pop() || 'asset', { type: uploadMime({ name: zipPath, type: blob.type }) });
      const uploaded = await uploadFileToStorage('source', uploadFile);
      files.push({ path: zipPath, storage_path: uploaded.path, bucket: uploaded.bucket, mime: uploadMime({ name: zipPath, type: blob.type }), size: blob.size });
      done += 1;
    }
    toast(tr('zipUploadManifest'));
    const manifest = {
      version: 2,
      originalName: file.name || 'project.zip',
      entry: normalizeZipPath(index.name),
      root: info.root,
      files
    };
    const indexRecord = files.find(item => item.path === normalizeZipPath(index.name));
    if (!indexRecord) throw new Error(tr('zipNoIndex'));
    return {
      bucket: indexRecord.bucket || 'erbello-artifacts',
      path: indexRecord.storage_path,
      mime: 'text/html',
      filename: file.name || 'project.zip',
      code: `${ZIP_MANIFEST_PREFIX}${JSON.stringify(manifest)}`,
      manifest
    };
  }

  async function uploadManualCodeIfNeeded(code, format) {
    const source = normalizeCode(code);
    const size = new Blob([source]).size;
    if (!source || size <= INLINE_CODE_LIMIT) return null;
    await assertZipStorageReady();
    const ext = format === 'jsx' ? 'jsx' : 'html';
    const file = new File([source], `erbello-source.${ext}`, { type: ext === 'jsx' ? 'text/javascript' : 'text/html' });
    return uploadFileToStorage('source', file);
  }

  function storageSourceCode(upload, format) {
    if (!upload || !upload.path) return '';
    return `${STORAGE_SOURCE_PREFIX}${JSON.stringify({
      bucket: upload.bucket,
      path: upload.path,
      mime: upload.mime,
      filename: upload.filename,
      source_kind: format || 'html'
    })}`;
  }


  async function optimizeImageFile(file, maxSide = 1600, quality = 0.84) {
    if (!file || !/^image\//i.test(file.type || '') || /svg|gif/i.test(file.type || '') || file.size < 700 * 1024) return file;
    let bitmap = null;
    try { bitmap = await createImageBitmap(file); } catch (_) { return file; }
    const scale = Math.min(1, maxSide / Math.max(bitmap.width || 1, bitmap.height || 1));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha:false });
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.size >= file.size) return file;
    const name = String(file.name || 'image').replace(/\.[a-z0-9]+$/i, '') + '.webp';
    toast(tr('imageOptimized'));
    return new File([blob], name, { type:'image/webp' });
  }

  function validScheme(value) { return SCHEMES.includes(value) ? value : 'black'; }
  function validColor(value) { return COLORS.includes(value) ? value : 'crimson'; }

  function migrateTheme(value) {
    const old = String(value || '').toLowerCase();
    if (old.includes('-')) {
      const [maybeScheme, maybeColor] = old.split('-');
      return { scheme: validScheme(maybeScheme), color: validColor(maybeColor) };
    }
    if (['cream','white'].includes(old)) return { scheme:'white', color: old === 'cream' ? 'cream' : 'crimson' };
    if (['rose','ocean','aurora','mint','pixel','dark','crimson','sky','lavender','yellowblue'].includes(old)) {
      return { scheme:'black', color: old === 'dark' ? 'crimson' : validColor(old) };
    }
    return { scheme:'black', color:'crimson' };
  }

  function applyTheme(scheme, color) {
    const safeScheme = validScheme(scheme);
    const safeColor = validColor(color);
    document.body.dataset.scheme = safeScheme;
    document.body.dataset.color = safeColor;
    document.body.dataset.theme = `${safeScheme}-${safeColor}`;
    safeStorage.set('local', 'erbello-scheme-v11', safeScheme);
    safeStorage.set('local', 'erbello-color-v11', safeColor);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = SCHEME_META_COLORS[safeScheme] || SCHEME_META_COLORS.black;
    updateThemeOptions();
  }

  function updateThemeOptions() {
    const currentScheme = validScheme(document.body.dataset.scheme);
    const currentColor = validColor(document.body.dataset.color);
    const currentNode = $('themeCurrent');
    if (currentNode) currentNode.textContent = themeButtonLabel(currentScheme, currentColor);
    document.querySelectorAll('[data-color-name]').forEach((option) => { option.textContent = colorLabel(option.dataset.colorName); });
    document.querySelectorAll('[data-color-choice]').forEach((button) => {
      const active = button.dataset.colorChoice === currentColor;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-scheme-choice]').forEach((button) => {
      const active = button.dataset.schemeChoice === currentScheme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function closeThemeMenu() {
    $('themePicker')?.classList.remove('open');
    $('themeToggle')?.setAttribute('aria-expanded', 'false');
    $('themeMenu')?.setAttribute('aria-hidden', 'true');
  }

  function toggleThemeMenu() {
    const picker = $('themePicker');
    if (!picker) return;
    const open = !picker.classList.contains('open');
    picker.classList.toggle('open', open);
    $('themeToggle')?.setAttribute('aria-expanded', open ? 'true' : 'false');
    $('themeMenu')?.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function applyLanguage(lang) {
    const safe = LANGS.includes(lang) ? lang : 'ko';
    currentLang = safe;
    safeStorage.set('local', 'erbello-lang', safe);
    document.documentElement.lang = safe === 'zh' ? 'zh-CN' : safe;
    document.body.dataset.lang = safe;
    const select = $('langSelect');
    if (select) select.value = safe;
    document.title = tr('pageTitle');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = tr('metaDescription');
    document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = tr(node.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => { node.placeholder = tr(node.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((node) => { node.setAttribute('aria-label', tr(node.dataset.i18nAriaLabel)); });
    document.querySelectorAll('[data-i18n-title]').forEach((node) => { node.setAttribute('title', tr(node.dataset.i18nTitle)); });
    updateThemeOptions();
    updateAdminButton();
    if ($('artifactModalTitle')) $('artifactModalTitle').textContent = editingId ? tr('artifactModalTitleEdit') : (contentKindValue() === 'post' ? tr('addPost') : tr('artifactModalTitleAdd'));
    if (PREVIEW_MODE) artifacts = getPreviewItems();
    renderPostAssetLibrary();
    renderFilters();
    renderQuickTags();
    renderRoute();
    updateDetectHint();
    detailQualityText();
  }

  function updateAdminButton() {
    const btn = $('adminBtn');
    if (btn) btn.textContent = isAdminOn() ? tr('ownerLogout') : tr('ownerLogin');
  }

  function setAdminUI(on) {
    document.body.classList.toggle('admin-on', Boolean(on));
    updateAdminButton();
    renderGrid();
    renderFeaturedGrid();
    renderAdminStats();
  }

  function openModal(id) { $(id)?.classList.add('open'); }
  function closeModal(id) { $(id)?.classList.remove('open'); }

  async function unlockAdmin() {
    const password = $('passwordInput').value.trim();
    $('adminError').textContent = '';
    if (!password) { $('adminError').textContent = tr('needPassword'); return; }
    try {
      await api('/api/admin/verify', { method:'POST', body:JSON.stringify({ password }) });
      adminToken = password;
      safeStorage.set('session', 'erbello-admin-token', password);
      $('passwordInput').value = '';
      closeModal('adminModal');
      setAdminUI(true);
      await loadArtifacts();
      toast(tr('ownerOn'));
      if (typeof window.__afterAdmin === 'function') { const cb = window.__afterAdmin; window.__afterAdmin = null; cb(); }
    } catch (error) {
      $('adminError').textContent = error.message.includes('configured') ? tr('notConfigured') : tr('wrongPassword');
    }
  }

  async function verifyExistingAdmin() {
    if (!ownerModeRequested || !adminToken || PREVIEW_MODE) return;
    try {
      await api('/api/admin/verify', { method:'POST', body:JSON.stringify({ password:adminToken }) });
      setAdminUI(true);
    } catch (_) {
      adminToken = '';
      safeStorage.remove('session', 'erbello-admin-token');
      setAdminUI(false);
    }
  }

  function requireAdmin(next) {
    if (PREVIEW_MODE) { toast(tr('previewNoSave')); return; }
    if (adminToken && isAdminOn()) { next(); return; }
    $('adminError').textContent = '';
    $('passwordInput').value = '';
    window.__afterAdmin = next;
    openModal('adminModal');
    setTimeout(() => $('passwordInput').focus(), 60);
  }

  function getPreviewItems() {
    const base = new Date('2026-05-12T00:00:00Z').getTime();
    return (dict().samples || I18N.ko.samples).map(([id, title, description, type], index) => ({ id, title, description, type, tags:[catLabel(type), id.includes('tarot') ? '타로' : '', id.includes('typing') ? '타자' : '', id.includes('pudding') ? '게임' : ''].filter(Boolean), format:id.includes('tarot') || id.includes('pudding') ? 'jsx' : 'html', is_jsx:id.includes('tarot') || id.includes('pudding'), status:'public', view_count: Math.max(0, 1280 - index * 117), created_at:new Date(base - index * 86400000).toISOString(), updated_at:new Date(base - index * 43200000).toISOString(), cover_image:'', gallery_images:[], detail_text:description, code:previewDocument(title, description) }));
  }

  function previewDocument(title, text) {
    return `<!doctype html><html lang="${document.documentElement.lang || 'ko'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 20% 10%,rgba(255,79,146,.18),transparent 25rem),radial-gradient(circle at 80% 20%,rgba(42,216,255,.14),transparent 28rem),linear-gradient(#0a1220 1px,transparent 1px),linear-gradient(90deg,#0a1220 1px,transparent 1px),#050914;background-size:auto,auto,28px 28px,28px 28px;color:#f7f8ff;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.box{width:min(760px,calc(100% - 36px));padding:42px;border:1px solid rgba(255,79,146,.35);background:rgba(7,13,24,.88);box-shadow:0 28px 80px rgba(0,0,0,.42);clip-path:polygon(18px 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%,0 18px)}.label{color:#ff4f92;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:950;letter-spacing:.18em;text-transform:uppercase;font-size:12px}h1{font-size:clamp(30px,5vw,58px);letter-spacing:-.04em;line-height:1.08;margin:14px 0 16px}p{font-size:18px;line-height:1.75;color:#aeb8ca;margin:0}</style></head><body><main class="box"><div class="label">ERBELLO Preview</div><h1>${esc(title)}</h1><p>${esc(text)}</p></main></body></html>`;
  }

  function goRoute(route, replace = false) {
    const next = ROUTES.includes(route) ? route : 'home';
    if (next !== currentRoute || next !== 'posts') selectedPostId = null;
    currentRoute = next;
    if (!PREVIEW_MODE) {
      const url = pageUrl(next) + (ownerModeRequested ? '?admin=1' : '');
      if (replace) history.replaceState({ route:next }, '', url);
      else history.pushState({ route:next }, '', url);
    }
    renderRoute();
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function renderRoute() {
    document.querySelectorAll('.route-page').forEach((page) => page.classList.toggle('active', page.dataset.page === currentRoute));
    document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === currentRoute));
    const editBtn = $('editPageBtn');
    if (editBtn) editBtn.textContent = tr('editPage');
    renderPageContent();
    updateRouteMeta();
    renderFilters();
    renderFeaturedGrid();
    renderGrid();
    renderAdminStats();
  }

  function renderInfoBlocks(containerId, blocks) {
    const node = $(containerId);
    if (!node) return;
    const icons = ['</>', '▧', '✦', '◎'];
    node.innerHTML = (blocks || []).filter(block => block && (block.title || block.text)).map((block, index) => `<div class="info-row"><span class="info-icon" aria-hidden="true">${esc(icons[index] || '✦')}</span><div><h3>${esc(block.title)}</h3><p>${esc(block.text)}</p></div></div>`).join('');
  }

  function renderPageCards(containerId, blocks) {
    const node = $(containerId);
    if (!node) return;
    node.innerHTML = (blocks || []).filter(block => block && (block.title || block.text)).map((block, index) => `<article class="page-panel page-mini-card"><span class="page-mini-icon" aria-hidden="true">${['◇','▧','✦','◎'][index] || '✦'}</span><h2>${esc(block.title)}</h2><p>${esc(block.text)}</p></article>`).join('');
  }

  function normalizeContactUrl(value) {
    let url = String(value || '').trim();
    if (!url) return '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
    if (/^(https?:|mailto:)/i.test(url)) return url;
    if (/^www\./i.test(url) || /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}([/?#].*)?$/i.test(url)) return `https://${url}`;
    return url;
  }

  function isSafeContactUrl(url) { return /^(https?:|mailto:)/i.test(String(url || '')); }

  function contactHost(url) {
    const text = String(url || '').trim();
    if (!text) return '';
    if (/^mailto:/i.test(text)) return text.replace(/^mailto:/i, '');
    try { return new URL(text).hostname.replace(/^www\./, ''); } catch (_) { return text; }
  }

  function inferContactLabel(url) {
    const text = String(url || '').trim();
    const lower = text.toLowerCase();
    if (!text) return '';
    if (/^mailto:/i.test(text) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'Email';
    if (lower.includes('github.com')) return 'GitHub';
    if (lower.includes('instagram.com')) return 'Instagram';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'X';
    if (lower.includes('tiktok.com')) return 'TikTok';
    if (lower.includes('notion.site') || lower.includes('notion.so')) return 'Notion';
    if (lower.includes('canva.com')) return 'Canva';
    if (lower.includes('velog.io')) return 'Velog';
    if (lower.includes('blog')) return 'Blog';
    const host = contactHost(normalizeContactUrl(text));
    if (!host) return '';
    return host.split('.')[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function contactIcon(url, label) {
    const hay = `${url || ''} ${label || ''}`.toLowerCase();
    if (hay.includes('mail') || hay.includes('@')) return '✉';
    if (hay.includes('github')) return '⌘';
    if (hay.includes('instagram')) return '◎';
    if (hay.includes('youtube')) return '▶';
    if (hay.includes('twitter') || hay.includes('x.com')) return '𝕏';
    if (hay.includes('notion')) return '▣';
    if (hay.includes('canva')) return '◇';
    if (hay.includes('blog') || hay.includes('velog')) return '✎';
    return '↗';
  }

  function cleanContactLinks(links) {
    return (Array.isArray(links) ? links : []).map((link) => {
      const rawUrl = String(link && link.url || '').trim();
      const url = normalizeContactUrl(rawUrl);
      const label = String(link && link.label || '').trim() || inferContactLabel(url) || url;
      return { label, url };
    }).filter((link) => link.url && isSafeContactUrl(link.url)).slice(0, 12);
  }

  function renderContactLinks(page) {
    const emailNode = $('contactEmail');
    const linksNode = $('contactLinks');
    const links = cleanContactLinks(page.links || []);
    const email = String(page.email || '').trim();
    if (emailNode) {
      emailNode.innerHTML = email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : '';
    }
    if (!linksNode) return;
    if (!links.length && !email) {
      linksNode.innerHTML = `<div class="contact-empty">${esc(tr('contactEmpty'))}</div>`;
      return;
    }
    linksNode.innerHTML = links.map((link) => {
      const label = link.label || inferContactLabel(link.url) || link.url;
      const host = contactHost(link.url);
      return `<a class="contact-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer"><span class="contact-link-icon" aria-hidden="true">${esc(contactIcon(link.url, label))}</span><span class="contact-link-copy"><strong>${esc(label)}</strong><small>${esc(host)}</small></span><b>↗</b></a>`;
    }).join('');
  }

  function renderAdminStats() {
    const node = $('adminStats');
    if (!node) return;
    const total = artifacts.length;
    const totalViews = artifacts.reduce((sum, item) => sum + Number(item.view_count || 0), 0);
    const top = artifacts.reduce((best, item) => Number(item.view_count || 0) > Number(best && best.view_count || 0) ? item : best, null);
    if (!total) {
      node.innerHTML = `<div class="admin-stat-title">${esc(tr('adminStatsTitle'))}</div><div class="admin-stat-empty">${esc(tr('noStats'))}</div>`;
      return;
    }
    node.innerHTML = `<div class="admin-stat-title">${esc(tr('adminStatsTitle'))}</div>
      <div class="admin-stat"><span>${esc(tr('statProjects'))}</span><strong>${total}</strong></div>
      <div class="admin-stat"><span>${esc(tr('statViews'))}</span><strong>${totalViews.toLocaleString(LOCALE[currentLang] || 'ko-KR')}</strong></div>
      <div class="admin-stat admin-stat-wide"><span>${esc(tr('statTop'))}</span><strong>${esc(top && top.title ? compact(top.title, 32) : tr('noStats'))}</strong></div>`;
  }

  function newestArtifactDate() {
    const times = artifacts.map(item => new Date(item.updated_at || item.created_at || 0).getTime()).filter(Number.isFinite);
    if (!times.length) return '2026.05';
    return fmtMonth(new Date(Math.max(...times)).toISOString());
  }

  function renderPageContent() {
    const home = pageContent('home');
    if ($('homeScript')) $('homeScript').textContent = home.script || '';
    if ($('homeEyebrow')) $('homeEyebrow').textContent = home.eyebrow || '';
    const homeDisplay = parseHomeDisplayTitle(home.title);
    if ($('heroTitle')) {
      $('heroTitle').setAttribute('aria-label', homeDisplay.aria);
      $('heroTitle').classList.toggle('brand-wordmark-title', Boolean(homeDisplay.isBrand));
    }
    if ($('heroTitleMain')) $('heroTitleMain').textContent = homeDisplay.main;
    if ($('heroTitleSub')) $('heroTitleSub').textContent = homeDisplay.sub;
    if ($('homeBody')) $('homeBody').textContent = home.body || '';
    if ($('infoTitle')) $('infoTitle').textContent = home.infoTitle || 'ERBELLO.INFO';
    renderInfoBlocks('homeBlocks', home.blocks || []);
    if ($('infoDate')) $('infoDate').textContent = newestArtifactDate();

    const projects = pageContent('projects');
    if ($('projectsEyebrow')) $('projectsEyebrow').textContent = projects.eyebrow || '';
    if ($('projectsTitle')) $('projectsTitle').textContent = projects.title || '';
    if ($('projectsBody')) $('projectsBody').textContent = projects.body || '';

    const posts = pageContent('posts');
    if ($('postsEyebrow')) $('postsEyebrow').textContent = posts.eyebrow || tr('postsEyebrow');
    if ($('postsTitle')) $('postsTitle').textContent = posts.title || tr('postsTitle');
    if ($('postsBody')) $('postsBody').textContent = posts.body || tr('postsBody');

    const about = pageContent('about');
    if ($('aboutEyebrow')) $('aboutEyebrow').textContent = about.eyebrow || '';
    if ($('aboutTitle')) $('aboutTitle').textContent = about.title || '';
    if ($('aboutBody')) $('aboutBody').textContent = about.body || '';
    renderPageCards('aboutBlocks', about.blocks || []);

    const contact = pageContent('contact');
    if ($('contactEyebrow')) $('contactEyebrow').textContent = contact.eyebrow || '';
    if ($('contactTitle')) $('contactTitle').textContent = contact.title || '';
    if ($('contactBody')) $('contactBody').textContent = contact.body || '';
    renderContactLinks(contact);

    const privacy = pageContent('privacy');
    if ($('privacyEyebrow')) $('privacyEyebrow').textContent = privacy.eyebrow || '';
    if ($('privacyTitle')) $('privacyTitle').textContent = privacy.title || '';
    if ($('privacyBody')) $('privacyBody').textContent = privacy.body || '';
    renderPageCards('privacyBlocks', privacy.blocks || []);

    const terms = pageContent('terms');
    if ($('termsEyebrow')) $('termsEyebrow').textContent = terms.eyebrow || '';
    if ($('termsTitle')) $('termsTitle').textContent = terms.title || '';
    if ($('termsBody')) $('termsBody').textContent = terms.body || '';
    renderPageCards('termsBlocks', terms.blocks || []);
  }

  function renderFilters() {
    const keys = filterKeysForRoute(currentRoute);
    if (!keys.includes(currentFilter)) currentFilter = 'all';
    const targets = [
      { node:$('filters'), route:'projects' },
      { node:$('postFilters'), route:'posts' }
    ];
    targets.forEach(({ node, route }) => {
      if (!node) return;
      const routeKeys = filterKeysForRoute(route);
      node.innerHTML = routeKeys.map((key) => `<button class="filter-btn ${key === currentFilter && route === currentRoute ? 'active' : ''}" type="button" data-filter="${esc(key)}">${esc(catLabel(key))}</button>`).join('');
      node.querySelectorAll('[data-filter]').forEach((button) => {
        button.addEventListener('click', () => { currentFilter = button.dataset.filter || 'all'; if (currentRoute === 'posts') selectedPostId = null; renderFilters(); renderGrid(); });
      });
    });
  }

  function filteredArtifacts() {
    const q = searchQuery.trim().toLowerCase();
    return artifacts.filter((item) => {
      if (!isAdminOn() && statusKey(item) === 'draft') return false;
      if (!itemBelongsToRoute(item, currentRoute)) return false;
      const secret = isSecretItem(item);
      if (currentFilter === 'secret') {
        if (!secret) return false;
      } else if (secret) {
        return false;
      }
      const type = typeKey(item.type);
      const tags = visibleArtifactTags(item);
      if (!itemMatchesFilter(item, currentFilter)) return false;
      if (!q) return true;
      const kindText = isPostItem(item) ? 'post blog 포스트 블로그' : (item.is_jsx ? 'jsx react' : formatKey(item));
      return [item.title, item.description, type, tags.join(' '), postSubcategory(item), kindText].join(' ').toLowerCase().includes(q);
    });
  }

  function emptyMessage(home = false) {
    if (home) return `<div class="empty"><div><h2>${esc(tr('emptyHomeTitle'))}</h2><p>${esc(tr('emptyHomeText'))}</p></div></div>`;
    if (currentFilter === 'secret') return `<div class="empty"><div><h2>${esc(tr('emptySecretTitle'))}</h2><p>${esc(tr('emptySecretText'))}</p></div></div>`;
    if (currentRoute === 'posts') return `<div class="empty"><div><h2>${esc(tr('emptyPostTitle'))}</h2><p>${esc(tr('emptyPostText'))}</p></div></div>`;
    return ownerModeRequested ? `<div class="empty"><div><h2>${esc(tr('emptyOwnerTitle'))}</h2><p>${esc(tr('emptyOwnerText'))}</p></div></div>` : `<div class="empty"><div><h2>${esc(tr('emptyPublicTitle'))}</h2><p>${esc(tr('emptyPublicText'))}</p></div></div>`;
  }

  function visualProfile(item) {
    const hay = `${item.title || ''} ${item.description || ''} ${item.type || ''} ${artifactTags(item).join(' ')}`.toLowerCase();
    const checks = [ ['visual-receipt','🧾',['receipt','영수증','收据','レシート']], ['visual-tarot','🔮',['tarot','타로','塔罗','タロット']], ['visual-typing','⌨️',['typing','타자','타이핑','打字','タイピング']], ['visual-pudding','🍮',['pudding','푸딩','布丁','プリン']], ['visual-note','📝',['note','memo','메모','ノート','备忘']], ['visual-box','🎁',['random','box','랜덤','박스','随机','ボックス']], ['visual-night','🌙',['night','sky','diary','밤하늘','夜空']], ['visual-cherry','🌸',['cherry','blossom','벚꽃','桜','樱花']], ['visual-ocean','🌊',['ocean','sea','바다','오션','海']] ];
    for (const [klass, icon, words] of checks) if (words.some((word) => hay.includes(word.toLowerCase()))) return { klass, icon };
    const fallback = { html:['visual-cherry','🌐'], react:['visual-tarot','✨'], game:['visual-pudding','🎮'], tool:['visual-receipt','🛠️'], daily:['visual-note','📝'], design:['visual-ocean','🎨'], chart:['visual-ocean','📊'], experiment:['visual-box','🧪'], other:['visual-default','✦'] }[typeKey(item.type)] || ['visual-default','✦'];
    return { klass:fallback[0], icon:fallback[1] };
  }

  function cardMarkup(item, compactCard = false) {
    const type = typeKey(item.type);
    const post = isPostItem(item);
    const title = item.title || tr('untitled');
    const status = statusKey(item);
    const locked = status === 'private' && !isAdminOn();
    const draftAdmin = status === 'draft' && isAdminOn() ? `<span class="private-badge-admin draft-badge-admin">${esc(tr('draftBadge'))}</span>` : '';
    const views = Number(item.view_count || 0);
    if (locked) {
      return `<article class="card card-locked title-only-lock ${compactCard ? 'card-compact' : ''}" data-id="${esc(item.id)}" tabindex="0" aria-label="${esc(title)}">
        <div class="card-body"><h3 class="card-title">${esc(title)}</h3>
          <div class="locked-blind" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="card-foot"><span class="locked-badge">${esc(tr('privateBadge'))}</span></div>
        </div></article>`;
    }
    const desc = item.description || tr('noDescription');
    const profile = visualProfile(item);
    const extraTags = visibleArtifactTags(item).filter(tag => !tagMatchesCategory(tag, type)).slice(0, compactCard ? 2 : 4);
    const tagHtml = extraTags.length ? `<div class="card-tags">${extraTags.map(tag => `<span class="card-tag-chip">${esc(tag)}</span>`).join('')}</div>` : '';
    const privateAdmin = status === 'private' ? `<span class="private-badge-admin">🔒 ${esc(tr('privateBadge'))}</span>` : draftAdmin;
    return `<article class="card v21-card ${compactCard ? 'card-compact' : ''} ${post ? 'card-post' : ''} ${esc(profile.klass)}" data-id="${esc(item.id)}" tabindex="0" aria-label="${esc(title)}">
      <span class="card-sticker" aria-hidden="true">${esc(profile.icon)}</span>
      <div class="card-body"><div class="card-meta-line"><span class="tag">${esc(post ? tr('typePost') : catLabel(type))}</span><span class="card-date">${esc(fmtMonth(item.updated_at || item.created_at))}</span></div><h3 class="card-title">${esc(title)}${privateAdmin}</h3><p class="card-desc">${esc(compact(desc, 132))}</p>${tagHtml}
        <div class="card-foot"><span class="view-count admin-only">◉ ${esc(tr('views'))} ${views}</span><span class="card-charm" aria-hidden="true">✦</span>
          <div class="card-actions"><button class="circle-action" type="button" data-open="${esc(item.id)}" aria-label="${esc(tr('openProject'))}">↗</button><button class="circle-action" type="button" data-copy="${esc(item.id)}" aria-label="${esc(tr('copyLink'))}">⛓</button><button class="btn small admin-only" type="button" data-edit="${esc(item.id)}">${esc(tr('edit'))}</button><button class="btn small danger admin-only" type="button" data-remove="${esc(item.id)}">${esc(tr('delete'))}</button></div>
        </div></div></article>`;
  }

  function bindCardEvents(container) {
    if (!container) return;
    container.querySelectorAll('.card, .post-list-item').forEach((card) => {
      const id = card.dataset.id;
      const inlinePost = currentRoute === 'posts' && card.classList.contains('post-list-item');
      card.addEventListener('click', (event) => { if (!event.target.closest('button')) (inlinePost ? selectPost(id) : openArtifact(id)); });
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inlinePost ? selectPost(id) : openArtifact(id); } });
    });
    container.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => currentRoute === 'posts' ? selectPost(button.dataset.open) : openArtifact(button.dataset.open)));
    container.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', () => copyText(projectUrl(button.dataset.copy))));
    container.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => requireAdmin(() => editArtifact(button.dataset.edit))));
    container.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => requireAdmin(() => deleteArtifact(button.dataset.remove))));
  }

  function renderGrid() {
    const grid = currentRoute === 'posts' ? $('postsGrid') : $('grid');
    if (!grid) return;
    const items = filteredArtifacts();
    if (!items.length) { if (currentRoute === 'posts') renderPostSidebar(); grid.innerHTML = emptyMessage(false); renderPostReader([]); return; }
    if (currentRoute === 'posts' && !items.some(item => String(item.id) === String(selectedPostId))) selectedPostId = String(items[0].id);
    if (currentRoute === 'posts') renderPostSidebar();
    grid.innerHTML = currentRoute === 'posts'
      ? items.map((item) => postListMarkup(item)).join('')
      : items.map((item) => cardMarkup(item, false)).join('');
    bindCardEvents(grid);
    if (currentRoute === 'posts') renderPostReader(items);
  }

  function renderFeaturedGrid() {
    const grid = $('featuredGrid');
    if (!grid) return;
    const items = artifacts.filter(item => !isPostItem(item) && statusKey(item) !== 'draft' && !isSecretItem(item)).slice(0, 4);
    if (!items.length) { grid.innerHTML = emptyMessage(true); return; }
    grid.innerHTML = items.map((item) => cardMarkup(item, true)).join('');
    bindCardEvents(grid);
  }

  function postSidebarItems() {
    return artifacts.filter((item) => {
      if (!isPostItem(item)) return false;
      if (!isAdminOn() && statusKey(item) === 'draft') return false;
      return true;
    });
  }

  function setPostFilter(filter) {
    currentRoute = 'posts';
    currentFilter = filter || 'all';
    selectedPostId = null;
    renderFilters();
    renderGrid();
  }

  function renderPostSidebar(items = postSidebarItems()) {
    const recentNode = $('postRecentList');
    if (recentNode) {
      const recent = items.filter(item => !isSecretItem(item)).slice(0, 6);
      recentNode.innerHTML = recent.length
        ? recent.map(item => `<button class="post-recent-item ${String(item.id) === String(selectedPostId) ? 'active' : ''}" type="button" data-select-post="${esc(item.id)}"><strong>${esc(compact(item.title || tr('untitled'), 34))}</strong><small>${esc(fmtMonth(item.updated_at || item.created_at))}</small></button>`).join('')
        : `<p class="post-recent-empty">${esc(tr('postNoRecent'))}</p>`;
      recentNode.querySelectorAll('[data-select-post]').forEach((button) => {
        button.addEventListener('click', () => selectPost(button.dataset.selectPost));
      });
    }
  }

  function postListMarkup(item) {
    const type = typeKey(item.type);
    const title = item.title || tr('untitled');
    const status = statusKey(item);
    const locked = status === 'private' && !isAdminOn();
    const active = String(item.id) === String(selectedPostId);
    const sub = postSubcategory(item);
    const tags = visibleArtifactTags(item).filter(tag => !tagMatchesCategory(tag, type)).slice(0, 5);
    const date = fmtMonth(item.updated_at || item.created_at);
    if (locked) {
      return `<article class="post-list-item post-list-locked ${active ? 'active' : ''}" data-id="${esc(item.id)}" tabindex="0" aria-label="${esc(title)}"><div class="post-list-date">${esc(date)}</div><div class="post-list-copy"><p class="post-list-category">${esc(tr('privateBadge'))}</p><h3>${esc(title)}</h3><div class="locked-blind" aria-hidden="true"><span></span><span></span></div></div><span class="post-list-arrow" aria-hidden="true">♡</span></article>`;
    }
    const desc = item.description || item.detail_text || tr('noDescription');
    return `<article class="post-list-item ${active ? 'active' : ''}" data-id="${esc(item.id)}" tabindex="0" aria-label="${esc(title)}"><div class="post-list-date">${esc(date)}</div><div class="post-list-copy"><p class="post-list-category">${esc(catLabel(type))}${sub ? ` · ${esc(sub)}` : ''}</p><h3>${esc(title)}</h3><p>${esc(compact(desc, 150))}</p>${tags.length ? `<div class="post-list-tags">${tags.map(tag => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}</div><div class="post-list-actions"><button class="circle-action" type="button" data-open="${esc(item.id)}" aria-label="${esc(tr('openProject'))}">↗</button><button class="circle-action" type="button" data-copy="${esc(item.id)}" aria-label="${esc(tr('copyLink'))}">⛓</button><button class="btn small admin-only" type="button" data-edit="${esc(item.id)}">${esc(tr('edit'))}</button><button class="btn small danger admin-only" type="button" data-remove="${esc(item.id)}">${esc(tr('delete'))}</button></div></article>`;
  }

  function selectPost(id) {
    if (!id) return;
    selectedPostId = String(id);
    renderGrid();
  }

  function safePostAssetSrc(src) {
    const value = String(src || '').trim();
    if (/^https:\/\//i.test(value)) return value;
    if (/^\/assets\/illust\/imagegen-assets\/web\/[^?#]+\.(png|webp|jpg|jpeg|gif)$/i.test(value)) return value;
    if (/^\/assets\/illust\/post-assets\/[^?#]+\.(png|webp|jpg|jpeg|gif)$/i.test(value)) return value;
    if (/^\/assets\/illust\/[^?#]+\.(png|webp|jpg|jpeg|gif)$/i.test(value)) return value;
    return '';
  }

  function postBodyMarkup(value) {
    const body = String(value || '').trim();
    if (!body) return `<p class="post-reader-empty">${esc(tr('postReaderEmpty'))}</p>`;
    return body.split(/\n{2,}/).map((chunk) => {
      const text = chunk.trim();
      if (!text) return '';
      if (/^[-*_]{3,}$/.test(text)) return '<hr class="post-body-divider">';
      const image = text.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (image) {
        const src = safePostAssetSrc(image[2]);
        if (!src) return '';
        const alt = image[1] || tr('postAssetsLabel');
        const decorative = /\/(divider|index)-/i.test(src);
        return `<figure class="post-body-asset ${decorative ? 'decorative' : ''}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">${decorative ? '' : `<figcaption>${esc(alt)}</figcaption>`}</figure>`;
      }
      return `<p>${esc(text).replace(/\n/g, '<br />')}</p>`;
    }).join('');
  }

  function renderPostReader(items = filteredArtifacts()) {
    const node = $('postReader');
    if (!node) return;
    const item = items.find(post => String(post.id) === String(selectedPostId)) || items[0];
    if (!item) {
      node.innerHTML = `<div class="post-reader-placeholder"><strong>${esc(tr('postReaderChoose'))}</strong><p>${esc(tr('postOpenHint'))}</p></div>`;
      return;
    }
    const title = item.title || tr('untitled');
    const locked = statusKey(item) === 'private' && !isAdminOn();
    const sub = postSubcategory(item);
    const tags = visibleArtifactTags(item).filter(tag => !tagMatchesCategory(tag, typeKey(item.type))).slice(0, 8);
    if (locked) {
      node.innerHTML = `<header class="post-reader-head"><p class="post-reader-kicker">${esc(tr('privateBadge'))}</p><h2>${esc(title)}</h2><p>${esc(tr('lockedDescription'))}</p></header><div class="locked-blind post-reader-blind" aria-hidden="true"><span></span><span></span><span></span></div>`;
      return;
    }
    const parts = splitPostAttachmentText(item.detail_text || '');
    const body = postBodyMarkup(parts.body || item.description || '');
    const attachments = (parts.attachments || []).map(file => `<a class="detail-attachment" href="${esc(file.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(file.name || 'attachment')}</strong><small>${esc(file.mime || 'file')}${file.size ? ` · ${esc(formatBytes(file.size))}` : ''}</small><span>↗</span></a>`).join('');
    const status = statusKey(item);
    const adminStatus = isAdminOn() && status !== 'public' ? `<span class="post-reader-status">${esc(statusLabel(status))}</span>` : '';
    node.innerHTML = `<header class="post-reader-head"><p class="post-reader-kicker">${esc(catLabel(typeKey(item.type)))}${sub ? ` · ${esc(sub)}` : ''}</p><h2>${esc(title)}${adminStatus}</h2>${item.description ? `<p>${esc(item.description)}</p>` : ''}<div class="post-reader-meta"><span>${esc(fmtMonth(item.updated_at || item.created_at))}</span>${tags.map(tag => `<span>${esc(tag)}</span>`).join('')}</div></header><div class="post-reader-body">${body}</div>${attachments ? `<div class="detail-attachments post-reader-files">${attachments}</div>` : ''}`;
  }

  function findArtifact(id) { return artifacts.find((item) => String(item.id) === String(id)); }

  function openArtifact(id) {
    if (!id) return;
    if (PREVIEW_MODE || isAdminOn()) openViewer(id);
    else window.location.href = projectPath(id);
  }

  function openViewer(id) {
    const item = findArtifact(id);
    if (!item) return;
    currentId = id;
    const post = isPostItem(item);
    $('viewerTag').textContent = [post ? tr('typePost') : catLabel(typeKey(item.type)), ...visibleArtifactTags(item).slice(0, 3), formatLabel(item)].filter(Boolean).join(' · ');
    $('viewerTitle').textContent = item.title || tr('untitled');
    $('viewerDesc').textContent = item.description || item.detail_text || tr('ownerPreview');
    if ($('viewerViews')) $('viewerViews').textContent = `${tr('views')}: ${Number(item.view_count || 0)}`;
    const mediaNode = $('viewerMedia');
    if (mediaNode) {
      const imgs = [artifactCover(item), ...galleryImages(item)].filter(Boolean).slice(0, 6);
      mediaNode.innerHTML = imgs.map(src => `<img src="${esc(src)}" alt="" loading="lazy" />`).join('');
    }
    const frame = $('viewerFrame');
    if (PREVIEW_MODE) { frame.removeAttribute('src'); frame.srcdoc = post ? previewDocument(item.title || tr('untitled'), item.detail_text || item.description || '') : (item.code || previewDocument(item.title || tr('untitled'), item.description || '')); }
    else if (isAdminOn() && adminToken) {
      frame.removeAttribute('src');
      frame.srcdoc = `<div style="font-family:system-ui;padding:24px">Loading...</div>`;
      api(`/api/admin/render/${encodeURIComponent(id)}`, { headers:{ 'x-admin-token':adminToken } })
        .then((data) => { if (currentId === id) frame.srcdoc = data && data.html ? data.html : ''; })
        .catch((error) => { if (currentId === id) frame.srcdoc = `<pre style="font-family:monospace;padding:24px;color:#ff5573">${esc(error.message || 'Preview failed')}</pre>`; });
    } else {
      frame.removeAttribute('srcdoc');
      frame.src = post ? projectPath(id) : runPath(id);
    }
    $('viewer').classList.add('open');
  }

  function closeViewer() {
    $('viewer').classList.remove('open');
    const frame = $('viewerFrame');
    frame.removeAttribute('srcdoc');
    frame.src = 'about:blank';
    currentId = null;
  }

  async function loadArtifacts() {
    if (PREVIEW_MODE) { artifacts = getPreviewItems(); renderGrid(); renderFeaturedGrid(); return; }
    try { artifacts = await api('/api/artifacts', { headers: isAdminOn() && adminToken ? { 'x-admin-token': adminToken } : {} }); }
    catch (error) { console.error(error); artifacts = []; toast(tr('loadError')); }
    renderGrid(); renderFeaturedGrid();
  }

  async function loadPages() {
    if (PREVIEW_MODE) { pageRows = []; renderPageContent(); return; }
    try { pageRows = await api('/api/pages'); }
    catch (error) { console.error(error); pageRows = []; toast(tr('pageLoadError')); }
    renderPageContent();
  }

  function normalizeCode(code) {
    let text = String(code || '').trim();
    const fenced = text.match(/^```(?:html|jsx|tsx|javascript|js|typescript|ts|react)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) text = fenced[1].trim();
    return text;
  }

  function looksLikeJsx(code) {
    const text = normalizeCode(code);
    if (!text) return false;
    if (/^<!doctype\s+html/i.test(text) || /^<html[\s>]/i.test(text) || /<body[\s>]/i.test(text)) return false;
    return /from\s+['"]react['"]/i.test(text) || /^\s*import\s+/m.test(text) || /export\s+default\s+/i.test(text) || /className\s*=/.test(text) || /use(State|Effect|Ref|Memo|Callback|Reducer|Context)\s*\(/.test(text) || /return\s*\(?\s*<([A-Za-z]|>)/m.test(text);
  }

  function updateDetectHint() {
    const node = $('detectHint');
    if (!node) return;
    if (contentKindValue() === 'post') {
      node.textContent = tr('formatPost');
      if ($('formatInput')) $('formatInput').value = 'post';
      if ($('formatBadge')) $('formatBadge').textContent = tr('formatPost');
      return;
    }
    const code = $('codeInput')?.value || '';
    const currentFormat = formatKey($('formatInput')?.value || '');
    if (pendingSourceFile) {
      if (currentFormat === 'zip') node.textContent = pendingZipInfo ? `${tr('detectZip')} · ${pendingZipInfo.index} · ${pendingZipInfo.count} files` : tr('detectZip');
      else if (currentFormat === 'jsx') node.textContent = tr('detectJsx');
      else node.textContent = tr('detectHtml');
      return;
    }
    if (pendingSourceStored && !code.trim()) { node.textContent = pendingSourceName ? `${pendingSourceName}` : tr('fileLoaded'); return; }
    if (!code.trim()) { node.textContent = tr('detectWaiting'); return; }
    if (currentFormat === 'zip') { node.textContent = tr('detectZip'); return; }
    const jsx = looksLikeJsx(code);
    node.textContent = jsx ? tr('detectJsx') : tr('detectHtml');
    if ($('formatInput')) $('formatInput').value = jsx ? 'jsx' : 'html';
    if ($('formatBadge')) $('formatBadge').textContent = jsx ? tr('formatJsx') : tr('formatHtml');
  }

  function splitPostAttachmentText(value) {
    const text = String(value || '').replace(/\r\n/g, '\n');
    const index = text.lastIndexOf(POST_ATTACH_PREFIX);
    if (index < 0) return { body:text.trim(), attachments:[] };
    const body = text.slice(0, index).trim();
    const raw = text.slice(index + POST_ATTACH_PREFIX.length).split(/\n/, 1)[0].trim();
    let parsed = [];
    try { parsed = JSON.parse(decodeURIComponent(raw)); } catch (_) { parsed = []; }
    const attachments = (Array.isArray(parsed) ? parsed : []).map((item) => ({
      name:String(item && item.name || 'attachment').replace(/[<>:"'`\\|?*\x00-\x1f]/g, '').trim().slice(0, 160) || 'attachment',
      url:String(item && item.url || '').trim().slice(0, 1200),
      mime:String(item && item.mime || '').trim().toLowerCase().slice(0, 120),
      size:Number(item && item.size || 0)
    })).filter(item => /^https:\/\//i.test(item.url)).slice(0, 12);
    return { body, attachments };
  }

  function detailWithPostAttachments(body, attachments) {
    const clean = (Array.isArray(attachments) ? attachments : []).map((item) => ({
      name:String(item && item.name || 'attachment').replace(/[<>:"'`\\|?*\x00-\x1f]/g, '').trim().slice(0, 160) || 'attachment',
      url:String(item && item.url || '').trim().slice(0, 1200),
      mime:String(item && item.mime || '').trim().toLowerCase().slice(0, 120),
      size:Number(item && item.size || 0)
    })).filter(item => /^https:\/\//i.test(item.url)).slice(0, 12);
    const text = String(body || '').trim();
    if (!clean.length) return text;
    return `${text}\n\n${POST_ATTACH_PREFIX}${encodeURIComponent(JSON.stringify(clean))}`;
  }

  function renderPostAssetLibrary() {
    const node = $('postAssetLibrary');
    if (!node) return;
    node.innerHTML = POST_ASSETS.map((asset) => `<button class="post-asset-btn" type="button" draggable="true" data-post-asset="${esc(asset.file)}" title="${esc(tr('insertAsset'))}: ${esc(asset.label)}"><img src="${esc(asset.src)}" alt="" loading="lazy" /><span>${esc(asset.label)}</span></button>`).join('');
  }

  function postAssetMarkdown(asset) {
    return asset ? `![${asset.label}](${asset.src})` : '';
  }

  function insertPostMarkdown(snippet) {
    const node = $('detailInput');
    if (!snippet || !node) return;
    const block = `\n\n${snippet}\n\n`;
    const start = node.selectionStart ?? node.value.length;
    const end = node.selectionEnd ?? node.value.length;
    node.value = `${node.value.slice(0, start)}${block}${node.value.slice(end)}`;
    const caret = start + block.length;
    node.focus();
    node.setSelectionRange(caret, caret);
    detailQualityText();
  }

  function insertPostAsset(file) {
    const asset = POST_ASSETS.find(item => item.file === file);
    insertPostMarkdown(postAssetMarkdown(asset));
  }

  function renderPostFilePreviews() {
    const node = $('postFilePreview');
    if (!node) return;
    const existing = pendingPostAttachments.map((file, index) => (
      `<span class="post-file-chip"><a href="${esc(file.url)}" target="_blank" rel="noopener noreferrer">${esc(file.name || 'attachment')}</a><small>${esc(file.mime || 'file')}${file.size ? ` · ${esc(formatBytes(file.size))}` : ''}</small><button type="button" data-remove-post-attachment="${index}" aria-label="remove">×</button></span>`
    ));
    const pending = pendingPostFiles.map((file, index) => (
      `<span class="post-file-chip pending"><strong>${esc(file.name || 'file')}</strong><small>${esc(formatBytes(file.size || 0))}</small><button type="button" data-remove-post-file="${index}" aria-label="remove">×</button></span>`
    ));
    node.innerHTML = [...existing, ...pending].join('');
    node.classList.toggle('empty', !existing.length && !pending.length);
  }

  function renderImagePreviews() {
    const cover = $('coverPreview');
    if (cover) {
      if (pendingCoverImage) cover.innerHTML = `<img src="${esc(coverImageSrc(pendingCoverImage, { id:'pending-cover', title:$('titleInput')?.value || 'pending' }))}" alt="" />`;
      else cover.textContent = tr('coverEmpty');
      cover.classList.toggle('empty-preview', !pendingCoverImage);
      cover.classList.toggle('random-preview', isRandomGamsungCover(pendingCoverImage));
    }
    const gallery = $('galleryPreview');
    if (gallery) {
      gallery.innerHTML = pendingGalleryImages.map((src, index) => `<span class="gallery-thumb"><img src="${esc(src)}" alt="" /><button type="button" data-remove-gallery="${index}">×</button></span>`).join('');
    }
    renderPostFilePreviews();
  }

  function updatePrivateFields() {
    const checked = Boolean($('privateInput') && $('privateInput').checked);
    const panel = document.querySelector('.private-panel');
    if (panel) panel.classList.toggle('private-on', checked);
  }

  function contentKindValue() {
    return $('contentKindInput') && $('contentKindInput').value === 'post' ? 'post' : 'project';
  }

  function updateContentKindFields() {
    const isPost = contentKindValue() === 'post';
    const modal = $('artifactModal');
    if (modal) modal.classList.toggle('post-mode', isPost);
    if ($('formatInput')) {
      if (isPost) $('formatInput').value = 'post';
      else if (formatKey($('formatInput').value) === 'post') $('formatInput').value = 'html';
    }
    if ($('formatBadge')) $('formatBadge').textContent = isPost ? tr('formatPost') : formatLabel($('formatInput')?.value || 'html');
    if (!isPost && $('postSubcategoryInput')) $('postSubcategoryInput').value = '';
    const detailLabel = document.querySelector('label[for="detailInput"]');
    if (detailLabel) detailLabel.textContent = isPost ? tr('postDetailLabel') : tr('detailLabel');
    const typeLabel = document.querySelector('label[for="typeInput"]');
    if (typeLabel) typeLabel.textContent = isPost ? tr('postMajorCategoryLabel') : tr('categoryLabel');
    const detailHint = document.querySelector('[data-i18n="detailHint"]');
    if (detailHint) detailHint.textContent = isPost ? tr('postDetailHint') : tr('detailHint');
    if ($('detailInput')) $('detailInput').placeholder = isPost ? tr('postDetailHint') : tr('detailPlaceholder');
    if ($('artifactModalTitle')) {
      $('artifactModalTitle').textContent = editingId ? tr('artifactModalTitleEdit') : (isPost ? tr('addPost') : tr('artifactModalTitleAdd'));
    }
    renderPostAssetLibrary();
    updateDetectHint();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }

  async function resizeImageFile(file, maxW = 1280, maxH = 720, quality = 0.82) {
    if (!file || !/^image\//.test(file.type || '')) return '';
    if (file.size > 12 * 1024 * 1024) throw new Error(tr('imageTooLarge'));
    const dataUrl = await readFileAsDataUrl(file);
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
    let { width, height } = img;
    const ratio = Math.min(1, maxW / width, maxH / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/webp', quality);
  }

  async function handleCoverFile(file) {
    if (!file) return;
    try {
      toast(tr('imageProcessing'));
      pendingCoverFile = file;
      pendingCoverImage = URL.createObjectURL(file);
      renderImagePreviews();
      toast(tr('imageLoaded'));
    } catch (error) { console.error(error); toast(error.message || tr('imageTooLarge')); }
  }

  async function handleGalleryFiles(files) {
    const list = Array.from(files || []).slice(0, Math.max(0, 8 - pendingGalleryImages.length));
    if (!list.length) return;
    try {
      toast(tr('imageProcessing'));
      for (const file of list) {
        pendingGalleryImages.push(URL.createObjectURL(file));
        pendingGalleryFiles.push(file);
      }
      pendingGalleryImages = pendingGalleryImages.slice(0, 8);
      pendingGalleryFiles = pendingGalleryFiles.slice(0, 8);
      renderImagePreviews();
      toast(tr('imageLoaded'));
    } catch (error) { console.error(error); toast(error.message || tr('imageTooLarge')); }
  }


  function detailQualityText() {
    const node = $('detailInput');
    const box = $('detailQuality');
    if (!node || !box) return;
    const len = node.value.trim().length;
    const ok = contentKindValue() === 'post' ? len >= 180 : len >= 350;
    box.className = `detail-quality ${ok ? 'good' : 'warn'}`;
    box.textContent = `${tr('detailChars')}: ${len} · ${ok ? tr('detailQualityGood') : tr('detailQualityShort')}`;
  }

  function fillDetailDraft() {
    const node = $('detailInput');
    if (!node) return;
    const title = $('titleInput')?.value.trim() || tr('untitled');
    const desc = $('descInput')?.value.trim() || '';
    const category = catLabel($('typeInput')?.value || 'other');
    const tags = collectArtifactTags().join(', ');
    const current = node.value.trim();
    if (current && current.length > 120 && !window.confirm('이미 상세 소개가 있습니다. 초안으로 덮어쓸까요?')) return;
    if (contentKindValue() === 'post') {
      node.value = `${title}\n\n${desc || '이 포스트에는 ERBELLO라는 활동명으로 만든 작업물과 기록을 정리합니다.'}\n\n작업을 만들게 된 이유, 사용하면서 느낀 점, 참고하면 좋은 부분을 자유롭게 적어둘 수 있습니다. 이미지가 필요한 경우 대표 이미지나 추가 이미지를 함께 등록해 글처럼 보여줄 수 있습니다.\n\n${tags ? `관련 태그는 ${tags}입니다. ` : ''}프로젝트 실행 코드가 없는 기록용 콘텐츠라면 포스트로 저장하면 되고, 실행 가능한 HTML/JSX/ZIP 작업물은 프로젝트로 저장하면 됩니다.`;
      detailQualityText();
      return;
    }
    node.value = `${title}는 ERBELLO에 보관된 ${category} 프로젝트입니다. ${desc || '짧게 열어보고 사용해볼 수 있는 개인 웹 프로젝트로, 아이디어를 실제 화면으로 옮기는 과정을 기록하기 위해 정리했습니다.'}\n\n이 상세 페이지에서는 프로젝트가 어떤 목적으로 만들어졌는지, 어떤 화면이나 기능을 확인하면 좋은지, 실행 전에 알아두면 좋은 정보를 함께 정리합니다. 방문자는 카드 목록에서 바로 실행 화면으로 이동하지 않고, 먼저 이 소개 페이지에서 프로젝트의 성격과 구성 요소를 확인할 수 있습니다.\n\n실행 버튼을 누르면 실제 HTML, JSX 또는 ZIP 기반 화면이 열립니다. 모바일과 PC에서 배치나 조작 방식이 다를 수 있으므로 화면 크기에 따라 주요 버튼, 입력 영역, 이미지 표시 방식이 어떻게 달라지는지도 확인해보면 좋습니다.\n\n${tags ? `관련 태그는 ${tags}입니다. ` : ''}커버 이미지와 추가 이미지가 등록된 경우에는 프로젝트 분위기와 주요 화면을 미리 볼 수 있습니다. 이 프로젝트는 작은 기능을 직접 사용해보고, 결과를 공유하거나 다시 확인할 수 있도록 구성했습니다.`;
    detailQualityText();
  }

  function resetArtifactForm() {
    editingId = null;
    $('artifactModalTitle').textContent = tr('artifactModalTitleAdd');
    $('titleInput').value = '';
    $('descInput').value = '';
    $('typeInput').value = 'tool';
    if ($('statusInput')) $('statusInput').value = 'public';
    if ($('contentKindInput')) $('contentKindInput').value = 'project';
    if ($('tagsInput')) $('tagsInput').value = '';
    if ($('postSubcategoryInput')) $('postSubcategoryInput').value = '';
    if ($('detailInput')) $('detailInput').value = '';
    if ($('privateInput')) $('privateInput').checked = false;
    if ($('privatePasswordInput')) $('privatePasswordInput').value = '';
    updatePrivateFields();
    pendingSourceFile = null;
    pendingSourceStored = false;
    pendingSourceName = '';
    pendingZipInfo = null;
    pendingCoverImage = '';
    pendingCoverFile = null;
    pendingGalleryImages = [];
    pendingGalleryFiles = [];
    pendingPostAttachments = [];
    pendingPostFiles = [];
    renderImagePreviews();
    detailQualityText();
    if ($('formatInput')) $('formatInput').value = 'html';
    if ($('formatBadge')) $('formatBadge').textContent = tr('formatHtml');
    $('codeInput').value = '';
    $('fileInput').value = '';
    if ($('postFileInput')) $('postFileInput').value = '';
    $('detectHint').textContent = tr('detectWaiting');
    $('artifactError').textContent = '';
    updateContentKindFields();
  }

  function openAddModal(kind = routeContentKind()) {
    resetArtifactForm();
    if ($('contentKindInput')) $('contentKindInput').value = kind === 'post' ? 'post' : 'project';
    updateContentKindFields();
    openModal('artifactModal');
    setTimeout(() => $('titleInput').focus(), 60);
  }

  async function editArtifact(id) {
    try {
      const item = PREVIEW_MODE ? findArtifact(id) : await api(`/api/admin/artifacts/${encodeURIComponent(id)}`, { headers:{ 'x-admin-token':adminToken } });
      if (!item) throw new Error('not found');
      editingId = id;
      $('artifactModalTitle').textContent = tr('artifactModalTitleEdit');
      $('titleInput').value = item.title || '';
      $('descInput').value = item.description || '';
      { const itemType = typeKey(item.type); $('typeInput').value = $('typeInput').querySelector(`option[value="${itemType}"]`) ? itemType : 'other'; }
      const isPost = isPostItem(item);
      if ($('tagsInput')) $('tagsInput').value = tagsText(isPost ? visibleArtifactTags(item) : (item.tags || []));
      if ($('postSubcategoryInput')) $('postSubcategoryInput').value = isPost ? postSubcategory(item) : '';
      const postParts = isPost ? splitPostAttachmentText(item.detail_text || '') : { body:item.detail_text || '', attachments:[] };
      if ($('detailInput')) $('detailInput').value = postParts.body || '';
      if ($('statusInput')) $('statusInput').value = statusKey(item);
      if ($('contentKindInput')) $('contentKindInput').value = isPost ? 'post' : 'project';
      if ($('privateInput')) $('privateInput').checked = statusKey(item) === 'private' || Boolean(item.is_private);
      if ($('privatePasswordInput')) $('privatePasswordInput').value = '';
      updatePrivateFields();
      pendingSourceFile = null;
      pendingSourceStored = Boolean(item.code_storage_path);
      pendingSourceName = item.source_filename || (pendingSourceStored ? 'Storage source' : '');
      pendingZipInfo = null;
      pendingCoverImage = item.cover_image || '';
      pendingCoverFile = null;
      pendingGalleryImages = galleryImages(item);
      pendingGalleryFiles = pendingGalleryImages.map(() => null);
      pendingPostAttachments = postParts.attachments;
      pendingPostFiles = [];
      renderImagePreviews();
      if ($('formatInput')) $('formatInput').value = formatKey(item);
      if ($('formatBadge')) $('formatBadge').textContent = formatLabel(item);
      $('codeInput').value = isPost || item.code_storage_path ? '' : (item.code || '');
      $('fileInput').value = '';
      if ($('postFileInput')) $('postFileInput').value = '';
      $('artifactError').textContent = '';
      updateContentKindFields();
      updateDetectHint();
      detailQualityText();
      openModal('artifactModal');
    } catch (error) { console.error(error); toast(tr('loadError')); }
  }

  async function saveArtifact() {
    if (PREVIEW_MODE) { toast(tr('previewNoSave')); return; }
    const title = $('titleInput').value.trim();
    const description = $('descInput').value.trim();
    const type = $('typeInput').value;
    let tags = collectArtifactTags();
    let detail_text = $('detailInput') ? $('detailInput').value.trim() : '';
    const isPost = contentKindValue() === 'post';
    const manualCode = isPost ? '' : normalizeCode($('codeInput').value);
    const status = $('statusInput') ? $('statusInput').value : (Boolean($('privateInput') && $('privateInput').checked) ? 'private' : 'public');
    const is_private = status === 'private' || Boolean($('privateInput') && $('privateInput').checked);
    const private_password = $('privatePasswordInput') ? $('privatePasswordInput').value.trim() : '';
    $('artifactError').textContent = '';
    const hasPostBody = Boolean(detail_text || description || pendingCoverImage || pendingCoverFile || pendingGalleryImages.length || pendingGalleryFiles.length || pendingPostAttachments.length || pendingPostFiles.length);
    if (!title) { $('artifactError').textContent = tr('required'); return; }
    if (isPost && !hasPostBody) { $('artifactError').textContent = tr('postBodyRequired'); return; }
    if (!isPost && !manualCode && !pendingSourceFile && !pendingSourceStored) { $('artifactError').textContent = tr('required'); return; }
    if (isPost) tags = postTagPayload(tags, $('postSubcategoryInput')?.value || '');
    try {
      const saveBtn = $('saveArtifactBtn');
      if (saveBtn) saveBtn.disabled = true;
      toast('Storage 업로드를 확인하는 중입니다...');
      let sourceUpload = null;
      let code = isPost ? POST_SOURCE_CODE : manualCode;
      let format = isPost ? 'post' : (($('formatInput') && $('formatInput').value) || (looksLikeJsx(code) ? 'jsx' : 'html'));
      if (!isPost && pendingSourceFile && isZipFile(pendingSourceFile)) {
        format = 'zip';
        sourceUpload = await uploadZipAsManifest(pendingSourceFile);
        code = sourceUpload.code;
      } else if (!isPost && pendingSourceFile) {
        sourceUpload = await uploadFileToStorage('source', pendingSourceFile);
        format = (($('formatInput') && $('formatInput').value) || (/\.(jsx?|tsx?)$/i.test(pendingSourceFile.name || '') ? 'jsx' : 'html'));
        code = storageSourceCode(sourceUpload, format);
      } else if (!isPost && manualCode) {
        const largeCodeUpload = await uploadManualCodeIfNeeded(manualCode, format);
        if (largeCodeUpload) {
          sourceUpload = largeCodeUpload;
          code = storageSourceCode(sourceUpload, format);
        }
      }

      let cover_image = pendingCoverImage || '';
      if (pendingCoverFile) {
        const optimizedCover = await optimizeImageFile(pendingCoverFile);
        const coverUpload = await uploadFileToStorage('cover', optimizedCover);
        cover_image = coverUpload.publicUrl || cover_image;
      }

      const gallery_images = [];
      for (let i = 0; i < pendingGalleryImages.length && i < 8; i += 1) {
        const file = pendingGalleryFiles[i];
        if (file) {
          const optimizedGallery = await optimizeImageFile(file);
          const uploaded = await uploadFileToStorage('gallery', optimizedGallery);
          if (uploaded.publicUrl) gallery_images.push(uploaded.publicUrl);
        } else if (pendingGalleryImages[i]) {
          gallery_images.push(pendingGalleryImages[i]);
        }
      }

      if (isPost) {
        const attachments = [...pendingPostAttachments];
        for (const file of pendingPostFiles.slice(0, Math.max(0, 12 - attachments.length))) {
          const uploaded = await uploadFileToStorage('post-file', file);
          if (uploaded && uploaded.publicUrl) {
            attachments.push({
              name:uploaded.filename || file.name || 'attachment',
              url:uploaded.publicUrl,
              mime:uploaded.mime || file.type || '',
              size:file.size || 0
            });
          }
        }
        detail_text = detailWithPostAttachments(detail_text, attachments);
      }

      const payload = {
        title, description, type, tags, status, format, source_kind: format, code, detail_text, cover_image, gallery_images, is_private, private_password,
        code_storage_bucket: sourceUpload ? sourceUpload.bucket : '',
        code_storage_path: sourceUpload ? sourceUpload.path : '',
        code_storage_mime: sourceUpload ? sourceUpload.mime : '',
        source_filename: sourceUpload ? sourceUpload.filename : ''
      };
      if (editingId) await api(`/api/admin/artifacts/${encodeURIComponent(editingId)}`, { method:'PUT', headers:{ 'x-admin-token':adminToken }, body:JSON.stringify(payload) });
      else await api('/api/admin/artifacts', { method:'POST', headers:{ 'x-admin-token':adminToken }, body:JSON.stringify(payload) });
      closeModal('artifactModal');
      toast(tr('saved'));
      await loadArtifacts();
    } catch (error) {
      console.error(error);
      $('artifactError').textContent = error.message || tr('saveError');
    } finally {
      const saveBtn = $('saveArtifactBtn');
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async function deleteArtifact(id) {
    if (!window.confirm(tr('confirmDelete'))) return;
    try {
      if (!PREVIEW_MODE) await api(`/api/admin/artifacts/${encodeURIComponent(id)}`, { method:'DELETE', headers:{ 'x-admin-token':adminToken } });
      toast(tr('deleted'));
      await loadArtifacts();
      if (currentId === id) closeViewer();
    } catch (error) { console.error(error); toast(error.message || tr('saveError')); }
  }

  function renderQuickTags() {
    const node = $('quickTags');
    if (!node) return;
    const selected = normalizeTags($('tagsInput')?.value || '').map(normalizeTagValue);
    node.innerHTML = CATEGORIES.filter(key => key !== 'all' && key !== 'secret' && key !== 'post').map((key) => {
      const label = catLabel(key);
      const active = selected.includes(normalizeTagValue(label)) || selected.includes(key);
      return `<button class="quick-tag ${active ? 'active' : ''}" type="button" data-quick-tag="${esc(label)}">#${esc(label)}</button>`;
    }).join('');
  }

  function collectArtifactTags() {
    return normalizeTags($('tagsInput')?.value || '');
  }

  function setArtifactTags(tags) {
    if ($('tagsInput')) $('tagsInput').value = tagsToInput(tags);
    renderQuickTags();
  }

  function toggleArtifactTag(tag) {
    const current = normalizeTags($('tagsInput')?.value || '');
    const key = normalizeTagValue(tag);
    const exists = current.some(item => normalizeTagValue(item) === key);
    const next = exists ? current.filter(item => normalizeTagValue(item) !== key) : [...current, tag];
    setArtifactTags(next);
  }

  function isZipFile(file) {
    return !!file && (/\.zip$/i.test(file.name || '') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed');
  }

  async function handleFile(file) {
    if (!file) return;
    const dz = $('dropZone');
    dz?.classList.remove('zip-ready','zip-error');
    $('artifactError').textContent = '';
    if (isZipFile(file)) {
      try {
        toast(tr('zipUploadCheck'));
        pendingZipInfo = await inspectZipFile(file);
        pendingSourceFile = file;
        pendingSourceStored = false;
        pendingSourceName = file.name || 'ZIP file';
        $('codeInput').value = '';
        if (!$('titleInput').value.trim()) $('titleInput').value = file.name.replace(/\.zip$/i, '').replace(/[-_]+/g, ' ');
        $('typeInput').value = 'tool';
        if ($('statusInput')) $('statusInput').value = 'public';
        if ($('formatInput')) $('formatInput').value = 'zip';
        if ($('formatBadge')) $('formatBadge').textContent = tr('formatZip');
        const tags = normalizeTags($('tagsInput')?.value || '');
        if (!tags.some(tag => tagMatchesCategory(tag, 'html'))) tags.push(catLabel('html'));
        if (!tags.some(tag => normalizeTagValue(tag) === 'zip')) tags.push('ZIP');
        setArtifactTags(tags);
        dz?.classList.add('zip-ready');
        updateDetectHint();
        if (pendingZipInfo.browserWarning) toast(pendingZipInfo.browserWarning);
        toast(`${tr('zipReady')} (${pendingZipInfo.index})`);
      } catch (error) {
        pendingSourceFile = null;
        pendingSourceStored = false;
        pendingSourceName = '';
        pendingZipInfo = null;
        dz?.classList.add('zip-error');
        $('artifactError').textContent = error.message || tr('zipReaderError');
        updateDetectHint();
      }
      return;
    }
    pendingSourceFile = file;
    pendingSourceStored = false;
    pendingSourceName = file.name || 'source file';
    pendingZipInfo = null;
    const reader = new FileReader();
    reader.onload = () => {
      $('codeInput').value = file.size <= 1024 * 1024 ? String(reader.result || '') : '';
      if (!$('titleInput').value.trim()) $('titleInput').value = file.name.replace(/\.(html?|jsx?|tsx?|txt)$/i, '').replace(/[-_]+/g, ' ');
      if (/\.(jsx?|tsx?)$/i.test(file.name || '')) {
        const tags = normalizeTags($('tagsInput')?.value || '');
        if (!tags.some(tag => tagMatchesCategory(tag, 'react'))) tags.push(catLabel('react'));
        setArtifactTags(tags);
      } else if (/\.html?$/i.test(file.name || '')) {
        const tags = normalizeTags($('tagsInput')?.value || '');
        if (!tags.some(tag => tagMatchesCategory(tag, 'html'))) tags.push(catLabel('html'));
        setArtifactTags(tags);
      }
      updateDetectHint();
      toast(tr('fileLoaded'));
    };
    reader.readAsText(file);
  }

  function contactLinkRowMarkup(link = {}, index = 0) {
    const url = String(link.url || '').trim();
    const label = String(link.label || '').trim();
    return `<div class="contact-link-row" data-contact-row="${index}">
      <div class="field compact-field"><label>${esc(tr('contactLinkName'))}</label><input class="input contact-label-input" type="text" maxlength="80" value="${esc(label)}" placeholder="GitHub" /></div>
      <div class="field compact-field"><label>${esc(tr('contactLinkUrl'))}</label><input class="input contact-url-input" type="text" maxlength="300" value="${esc(url)}" placeholder="https://..." /></div>
      <button class="btn small danger contact-remove-btn" type="button" data-remove-contact-link="1">${esc(tr('contactRemoveLink'))}</button>
    </div>`;
  }

  function renderContactLinkEditor(links = []) {
    const editor = $('contactLinkEditor');
    if (!editor) return;
    const rows = (Array.isArray(links) ? links : []).filter(link => link && (link.label || link.url));
    editor.innerHTML = rows.length ? rows.map((link, index) => contactLinkRowMarkup(link, index)).join('') : `<div class="link-editor-empty">${esc(tr('contactEmpty'))}</div>`;
  }

  function addContactLinkRow(link = {}) {
    const editor = $('contactLinkEditor');
    if (!editor) return;
    if (editor.querySelector('.link-editor-empty')) editor.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.innerHTML = contactLinkRowMarkup(link, editor.querySelectorAll('.contact-link-row').length);
    const row = wrap.firstElementChild;
    editor.appendChild(row);
    const urlInput = row.querySelector('.contact-url-input');
    if (urlInput) urlInput.focus();
  }

  function collectContactLinks() {
    return cleanContactLinks(Array.from(document.querySelectorAll('#contactLinkEditor .contact-link-row')).map((row) => {
      const label = row.querySelector('.contact-label-input')?.value || '';
      const url = row.querySelector('.contact-url-input')?.value || '';
      return { label, url };
    }));
  }

  function updatePageEditorVisibility() {
    const slug = $('pageSlugInput')?.value || currentRoute;
    const isHome = slug === 'home';
    const isAbout = slug === 'about';
    const isContact = slug === 'contact';
    const isPolicy = slug === 'privacy' || slug === 'terms';
    const hasFilters = slug === 'projects' || slug === 'posts';
    const setHidden = (id, hidden) => { const node = $(id); if (node) node.hidden = hidden; };
    setHidden('pageScriptField', !isHome);
    setHidden('pageInfoField', !isHome);
    setHidden('pageBlocksEditor', !(isHome || isAbout || isPolicy));
    setHidden('pageEmailField', !isContact);
    setHidden('pageLinksField', !isContact);
    setHidden('pageFilterField', !hasFilters);
  }

  function fillPageEditor() {
    const slug = $('pageSlugInput').value || currentRoute;
    const lang = $('pageLangInput').value || currentLang;
    const page = pageContent(slug, lang);
    $('pageScriptInput').value = page.script || '';
    $('pageEyebrowInput').value = page.eyebrow || '';
    $('pageInfoTitleInput').value = page.infoTitle || '';
    $('pageTitleInput').value = page.title || '';
    $('pageBodyInput').value = page.body || '';
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    for (let i = 1; i <= 3; i += 1) {
      $(`block${i}Title`).value = (blocks[i - 1] && blocks[i - 1].title) || '';
      $(`block${i}Text`).value = (blocks[i - 1] && blocks[i - 1].text) || '';
    }
    $('pageEmailInput').value = page.email || '';
    if ($('pageFilterOrderInput')) $('pageFilterOrderInput').value = normalizeFilterOrder(page.filterOrder, slug).join(', ');
    renderContactLinkEditor(page.links || []);
    updatePageEditorVisibility();
    $('pageError').textContent = '';
  }

  function openPageEditor() {
    $('pageSlugInput').value = currentRoute;
    $('pageLangInput').value = currentLang;
    fillPageEditor();
    openModal('pageModal');
  }

  async function savePage() {
    if (PREVIEW_MODE) { toast(tr('previewNoSave')); return; }
    const slug = $('pageSlugInput').value;
    const lang = $('pageLangInput').value;
    const blocks = [1,2,3].map((i) => ({ title:$(`block${i}Title`).value.trim(), text:$(`block${i}Text`).value.trim() })).filter(block => block.title || block.text);
    const content = { script:$('pageScriptInput').value.trim(), eyebrow:$('pageEyebrowInput').value.trim(), infoTitle:$('pageInfoTitleInput').value.trim(), title:$('pageTitleInput').value.trim(), body:$('pageBodyInput').value.trim(), blocks, email:$('pageEmailInput').value.trim(), links: slug === 'contact' ? collectContactLinks() : [], filterOrder: (slug === 'projects' || slug === 'posts') ? normalizeFilterOrder($('pageFilterOrderInput')?.value || '', slug) : [] };
    try {
      $('pageError').textContent = '';
      const row = await api(`/api/admin/pages/${encodeURIComponent(slug)}/${encodeURIComponent(lang)}`, { method:'PUT', headers:{ 'x-admin-token':adminToken }, body:JSON.stringify({ content }) });
      const index = pageRows.findIndex(item => item.slug === slug && item.lang === lang);
      if (index === -1) pageRows.push(row);
      else pageRows[index] = row;
      closeModal('pageModal');
      toast(tr('pageSaved'));
      renderPageContent();
    } catch (error) { console.error(error); $('pageError').textContent = error.message || tr('pageSaveError'); }
  }


  function syncStatusPrivate() {
    const status = $('statusInput') ? $('statusInput').value : 'public';
    if ($('privateInput')) $('privateInput').checked = status === 'private';
    updatePrivateFields();
  }
  function syncPrivateStatus() {
    if (!$('statusInput') || !$('privateInput')) return;
    $('statusInput').value = $('privateInput').checked ? 'private' : ($('statusInput').value === 'private' ? 'public' : $('statusInput').value);
    updatePrivateFields();
  }

  function exportProjectList() {
    if (!artifacts.length) { toast(tr('noStats')); return; }
    const text = artifacts.map((item, index) => {
      const tags = visibleArtifactTags(item).join(', ');
      const post = isPostItem(item);
      return [`#${index + 1}`,
        `제목: ${item.title || ''}`,
        `종류: ${post ? 'post' : 'project'}`,
        `상태: ${statusLabel(statusKey(item))}`,
        `대표 분류: ${catLabel(typeKey(item.type))}`,
        `태그: ${tags}`,
        `짧은 설명: ${item.description || ''}`,
        `상세 소개: ${item.detail_text || ''}`,
        `조회수: ${Number(item.view_count || 0)}`,
        `상세 URL: ${projectUrl(item.id)}`,
        post ? `실행 URL: 포스트는 실행 페이지 없음` : `실행 URL: ${runUrl(item.id)}`
      ].join('\n');
    }).join('\n\n---\n\n');
    copyText(text).then(() => toast(tr('exportCopied')));
  }

  function renderSystemStatus(data) {
    const node = $('systemStatusPanel');
    if (!node) return;
    const row = (label, ok, value = '', raw = false) => `<div class="system-row ${ok ? 'ok' : 'bad'}"><span>${esc(label)}</span><strong>${ok ? 'OK' : 'CHECK'}</strong><small>${raw ? value : esc(value || '')}</small></div>`;
    node.innerHTML = [
      row('Admin password', Boolean(data.adminConfigured), data.adminConfigured ? 'configured' : 'missing'),
      row('DB connection', Boolean(data.databaseOk || data.artifactsOk || data.pagesOk), data.mode || ''),
      row('Storage connection', Boolean(data.storageOk || data.mode === 'local-json'), data.mode === 'local-json' ? 'local-json' : 'Supabase Storage'),
      row('Artifacts table', Boolean(data.artifactsOk), `projects ${data.artifactCount ?? '-'}`),
      row('Site pages table', Boolean(data.pagesOk), `rows ${data.pageCount ?? '-'}`),
      row('Media bucket', Boolean(data.mediaBucketOk) || data.mode === 'local-json', data.mediaBucket || ''),
      row('Artifact bucket', Boolean(data.artifactBucketOk) || data.mode === 'local-json', data.artifactBucket || ''),
      row('Storage upload', Boolean(data.storageUploadOk) || data.mode === 'local-json', data.storageUploadOk ? 'signed upload ready' : (data.storageUploadError || 'check required')),
      row('Artifact storage columns', Boolean(data.artifactStorageColumnsOk) || data.mode === 'local-json', data.artifactStorageColumnsOk ? 'code_storage_* / source_filename ready' : (data.artifactStorageColumnsError || 'migration required')),
      row('Visibility counts', true, `public ${data.publicCount ?? 0} · private ${data.privateCount ?? 0} · draft ${data.draftCount ?? 0}`),
      row('Site URL', true, data.siteOrigin || location.origin),
      row('AdSense', Boolean(data.adsenseClient), data.adsenseClient || 'not configured'),
      row('ads.txt', true, `<a href="${esc(data.adsTxtUrl || '/ads.txt')}" target="_blank" rel="noopener noreferrer">${esc(data.adsTxtUrl || `${SITE_ORIGIN}/ads.txt`)}</a>`, true)
    ].join('');
  }

  async function openSystemStatus() {
    if (PREVIEW_MODE) { toast(tr('previewNoSave')); return; }
    openModal('systemModal');
    if ($('systemStatusPanel')) $('systemStatusPanel').innerHTML = '<div class="system-loading">Checking...</div>';
    try {
      const data = await api('/api/admin/system', { headers:{ 'x-admin-token':adminToken } });
      renderSystemStatus(data);
    } catch (error) {
      if ($('systemStatusPanel')) $('systemStatusPanel').innerHTML = `<div class="error">${esc(error.message || 'System check failed')}</div>`;
    }
  }

  function bindEvents() {
    $('themeToggle')?.addEventListener('click', toggleThemeMenu);
    document.querySelectorAll('[data-scheme-choice]').forEach((button) => button.addEventListener('click', () => { applyTheme(button.dataset.schemeChoice || 'black', validColor(document.body.dataset.color)); }));
    document.querySelectorAll('[data-color-choice]').forEach((button) => button.addEventListener('click', () => { applyTheme(validScheme(document.body.dataset.scheme), button.dataset.colorChoice || 'crimson'); }));
    document.addEventListener('click', (event) => { if (!event.target.closest('#themePicker')) closeThemeMenu(); });
    $('langSelect')?.addEventListener('change', (event) => applyLanguage(event.target.value));
    document.querySelectorAll('[data-route]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); goRoute(link.dataset.route || 'home'); }));
    window.addEventListener('popstate', () => { currentRoute = initialRoute(); if (currentRoute !== 'posts') selectedPostId = null; renderRoute(); });
    const syncSearch = (value) => {
      searchQuery = value;
      if ($('searchInput') && $('searchInput').value !== value) $('searchInput').value = value;
      if ($('postSearchInput') && $('postSearchInput').value !== value) $('postSearchInput').value = value;
      renderGrid();
    };
    $('searchInput')?.addEventListener('input', (event) => syncSearch(event.target.value));
    $('postSearchInput')?.addEventListener('input', (event) => syncSearch(event.target.value));
    $('adminBtn')?.addEventListener('click', async () => {
      if (isAdminOn()) { setAdminUI(false); adminToken = ''; safeStorage.remove('session', 'erbello-admin-token'); await loadArtifacts(); toast(tr('ownerOffMsg')); }
      else { openModal('adminModal'); setTimeout(() => $('passwordInput').focus(), 60); }
    });
    $('editPageBtn')?.addEventListener('click', () => requireAdmin(openPageEditor));
    $('pageSlugInput')?.addEventListener('change', fillPageEditor);
    $('pageLangInput')?.addEventListener('change', fillPageEditor);
    $('addContactLinkBtn')?.addEventListener('click', () => addContactLinkRow({}));
    $('contactManageBtn')?.addEventListener('click', () => requireAdmin(() => { $('pageSlugInput').value = 'contact'; $('pageLangInput').value = currentLang; fillPageEditor(); openModal('pageModal'); }));
    $('contactLinkEditor')?.addEventListener('click', (event) => { const btn = event.target.closest('[data-remove-contact-link]'); if (!btn) return; const row = btn.closest('.contact-link-row'); if (row) row.remove(); if (!$('contactLinkEditor').querySelector('.contact-link-row')) renderContactLinkEditor([]); });
    $('contactLinkEditor')?.addEventListener('input', (event) => { if (!event.target.classList.contains('contact-url-input')) return; const row = event.target.closest('.contact-link-row'); const labelInput = row && row.querySelector('.contact-label-input'); if (labelInput && !labelInput.value.trim()) labelInput.value = inferContactLabel(normalizeContactUrl(event.target.value)); });
    $('savePageBtn')?.addEventListener('click', savePage);
    $('addBtn')?.addEventListener('click', () => requireAdmin(() => openAddModal('project')));
    $('addBtnToolbar')?.addEventListener('click', () => requireAdmin(() => openAddModal('project')));
    $('postAddBtn')?.addEventListener('click', () => requireAdmin(() => openAddModal('post')));
    $('postAddBtnToolbar')?.addEventListener('click', () => requireAdmin(() => openAddModal('post')));
    document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));
    document.querySelectorAll('.overlay').forEach((overlay) => overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(overlay.id); }));
    $('unlockBtn')?.addEventListener('click', unlockAdmin);
    $('passwordInput')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') unlockAdmin(); });
    $('saveArtifactBtn')?.addEventListener('click', saveArtifact);
    $('statusInput')?.addEventListener('change', syncStatusPrivate);
    $('privateInput')?.addEventListener('change', syncPrivateStatus);
    $('contentKindInput')?.addEventListener('change', () => {
      if (contentKindValue() === 'post') {
        pendingSourceFile = null;
        pendingSourceStored = false;
        pendingSourceName = '';
        pendingZipInfo = null;
        if ($('fileInput')) $('fileInput').value = '';
        if ($('codeInput')) $('codeInput').value = '';
      }
      updateContentKindFields();
      renderPostFilePreviews();
      detailQualityText();
    });
    $('detailInput')?.addEventListener('input', detailQualityText);
    $('fillDetailBtn')?.addEventListener('click', fillDetailDraft);
    $('exportBtn')?.addEventListener('click', () => requireAdmin(exportProjectList));
    $('systemBtn')?.addEventListener('click', () => requireAdmin(openSystemStatus));
    $('tagsInput')?.addEventListener('input', renderQuickTags);
    $('quickTags')?.addEventListener('click', (event) => { const btn = event.target.closest('[data-quick-tag]'); if (btn) toggleArtifactTag(btn.dataset.quickTag || ''); });
    $('codeInput')?.addEventListener('input', () => {
      if (($('codeInput')?.value || '').trim()) {
        pendingSourceFile = null;
        pendingSourceStored = false;
        pendingSourceName = '';
        pendingZipInfo = null;
        if ($('fileInput')) $('fileInput').value = '';
      }
      updateDetectHint();
    });
    $('privateInput')?.addEventListener('change', updatePrivateFields);
    $('fileInput')?.addEventListener('change', (event) => handleFile(event.target.files && event.target.files[0]));
    $('coverInput')?.addEventListener('change', (event) => handleCoverFile(event.target.files && event.target.files[0]));
    $('galleryInput')?.addEventListener('change', (event) => handleGalleryFiles(event.target.files));
    $('postFileInput')?.addEventListener('change', (event) => {
      const list = Array.from(event.target.files || []);
      pendingPostFiles = [...pendingPostFiles, ...list].slice(0, 12);
      event.target.value = '';
      renderPostFilePreviews();
    });
    $('postAssetLibrary')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-post-asset]');
      if (btn) insertPostAsset(btn.dataset.postAsset || '');
    });
    $('postAssetLibrary')?.addEventListener('dragstart', (event) => {
      const btn = event.target.closest('[data-post-asset]');
      if (!btn || !event.dataTransfer) return;
      const asset = POST_ASSETS.find(item => item.file === btn.dataset.postAsset);
      const markdown = postAssetMarkdown(asset);
      event.dataTransfer.setData('text/plain', markdown);
      event.dataTransfer.setData('application/x-erbello-post-asset', markdown);
    });
    $('detailInput')?.addEventListener('dragover', (event) => {
      if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('application/x-erbello-post-asset')) event.preventDefault();
    });
    $('detailInput')?.addEventListener('drop', (event) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes('application/x-erbello-post-asset')) return;
      event.preventDefault();
      insertPostMarkdown(event.dataTransfer.getData('application/x-erbello-post-asset') || event.dataTransfer.getData('text/plain'));
    });
    $('clearCoverBtn')?.addEventListener('click', () => { pendingCoverImage = ''; pendingCoverFile = null; if ($('coverInput')) $('coverInput').value = ''; renderImagePreviews(); });
    $('randomCoverBtn')?.addEventListener('click', () => { pendingCoverImage = RANDOM_GAMSUNG_COVER; pendingCoverFile = null; if ($('coverInput')) $('coverInput').value = ''; renderImagePreviews(); toast(tr('randomCoverActive')); });
    $('clearGalleryBtn')?.addEventListener('click', () => { pendingGalleryImages = []; pendingGalleryFiles = []; if ($('galleryInput')) $('galleryInput').value = ''; renderImagePreviews(); });
    $('galleryPreview')?.addEventListener('click', (event) => { const btn = event.target.closest('[data-remove-gallery]'); if (!btn) return; const index = Number(btn.dataset.removeGallery); pendingGalleryImages.splice(index, 1); pendingGalleryFiles.splice(index, 1); renderImagePreviews(); });
    $('postFilePreview')?.addEventListener('click', (event) => {
      const attachmentBtn = event.target.closest('[data-remove-post-attachment]');
      const fileBtn = event.target.closest('[data-remove-post-file]');
      if (attachmentBtn) {
        pendingPostAttachments.splice(Number(attachmentBtn.dataset.removePostAttachment), 1);
        renderPostFilePreviews();
      }
      if (fileBtn) {
        pendingPostFiles.splice(Number(fileBtn.dataset.removePostFile), 1);
        renderPostFilePreviews();
      }
    });
    const dz = $('dropZone');
    if (dz) {
      ['dragenter','dragover'].forEach((name) => dz.addEventListener(name, (event) => { event.preventDefault(); dz.classList.add('drag'); }));
      ['dragleave','drop'].forEach((name) => dz.addEventListener(name, (event) => { event.preventDefault(); dz.classList.remove('drag'); }));
      dz.addEventListener('drop', (event) => handleFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]));
    }
    $('closeViewerBtn')?.addEventListener('click', closeViewer);
    $('copyRunBtn')?.addEventListener('click', () => {
      if (!currentId) return;
      const item = findArtifact(currentId);
      copyText(isPostItem(item) ? projectUrl(currentId) : runUrl(currentId));
    });
    $('openRunBtn')?.addEventListener('click', () => {
      if (!currentId) return;
      const item = findArtifact(currentId);
      window.open(isPostItem(item) ? projectPath(currentId) : runPath(currentId), '_blank', 'noopener,noreferrer');
    });
    $('editBtn')?.addEventListener('click', () => currentId && requireAdmin(() => editArtifact(currentId)));
    $('deleteBtn')?.addEventListener('click', () => currentId && requireAdmin(() => deleteArtifact(currentId)));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeThemeMenu(); document.querySelectorAll('.overlay.open').forEach((modal) => modal.classList.remove('open')); if ($('viewer')?.classList.contains('open')) closeViewer(); } });
  }

  async function init() {
    console.info(VERSION);
    if (PREVIEW_MODE) document.body.classList.add('preview-mode');
    if (ownerModeRequested) document.body.classList.add('owner-requested');
    const storedScheme = safeStorage.get('local', 'erbello-scheme-v11');
    const storedColor = safeStorage.get('local', 'erbello-color-v11');
    applyTheme(SCHEMES.includes(storedScheme) ? storedScheme : 'white', COLORS.includes(storedColor) ? storedColor : 'pixel');
    bindEvents();
    const storedLang = safeStorage.get('local', 'erbello-lang');
    applyLanguage(LANGS.includes(storedLang) ? storedLang : 'ko');
    await verifyExistingAdmin();
    await loadPages();
    await loadArtifacts();
    renderRoute();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
