(() => {
  'use strict';

  const VERSION = 'ERBELLO Gallery v12 contact manager + admin stats';
  const PREVIEW_MODE = document.body.dataset.preview === '1';
  const ownerModeRequested = new URLSearchParams(location.search).get('admin') === '1' || location.hash.includes('admin');
  const SCHEMES = ['black','white'];
  const COLORS = ['crimson','sky','lavender','yellowblue','cream','rose','ocean','aurora','mint','pixel'];
  const LANGS = ['ko','en','ja','zh'];
  const ROUTES = ['home','projects','about','contact'];
  const CATEGORIES = ['all', 'html', 'react', 'game', 'tool', 'daily', 'design', 'chart', 'experiment', 'other'];
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
      pageTitle:'ERBELLO Gallery', metaDescription:'ERBELLO의 개인 프로젝트 갤러리입니다.', brandAria:'ERBELLO 홈으로 이동', brandSubtitle:'Project Gallery', navAria:'주요 메뉴', navHome:'홈', navProjects:'프로젝트', navAbout:'소개', navContact:'연락처',
      topControlsAria:'언어와 테마 설정', languageLabel:'언어', languageAria:'언어 선택', themeLabel:'테마', themeAria:'테마 선택', schemeLabel:'배경 계열', colorLabel:'포인트 컬러', schemeBlack:'Black', schemeWhite:'White', ownerLogin:'소유자 로그인', ownerLogout:'소유자 모드 종료', editPage:'페이지 편집', addProject:'프로젝트 추가',
      previewBadge:'미리보기', previewNotice:'이 파일은 디자인 확인용입니다. 실제 저장은 배포된 사이트에서 진행됩니다.', lastUpdate:'LAST UPDATE', recentKicker:'최근', recentProjects:'최근 프로젝트', viewAllProjects:'전체 프로젝트 보기',
      sectionKicker:'프로젝트', galleryTitle:'프로젝트 갤러리', searchPlaceholder:'프로젝트 검색...', searchAria:'프로젝트 검색', filterAria:'카테고리 필터', viewerAria:'소유자 미리보기', viewerFrameTitle:'프로젝트 미리보기', ownerPreview:'소유자 미리보기', openProject:'프로젝트 열기', copyLink:'링크 복사', openNewTab:'새 탭 열기', edit:'수정', delete:'삭제', close:'닫기',
      cancel:'취소', login:'로그인', save:'저장', adminHint:'프로젝트 추가, 수정, 삭제는 소유자 모드에서만 가능합니다.', passwordLabel:'관리자 비밀번호', passwordPlaceholder:'Vercel에 설정한 ADMIN_PASSWORD',
      pageModalTitle:'페이지 내용 편집', pageLabel:'페이지', scriptLabel:'말풍선 문구', eyebrowLabel:'작은 제목', infoTitleLabel:'정보 박스 제목', pageTitleLabel:'큰 제목', bodyLabel:'본문', blocksLabel:'정보 항목', blockTextLabel:'내용', emailLabel:'이메일', linksLabel:'링크', linksPlaceholder:'GitHub | https://github.com/...\nInstagram | https://instagram.com/...', contactLinksTitle:'연락처 링크', contactLinkName:'표시 이름', contactLinkUrl:'링크 주소', contactAddLink:'링크 추가', contactRemoveLink:'삭제', contactLinkHint:'연락처 페이지에는 링크 주소가 있는 항목만 표시됩니다. 이름은 비워도 주소를 보고 자동으로 채워집니다.', contactEmpty:'아직 등록된 연락처 링크가 없습니다.', manageContactLinks:'연락처 링크 관리', adminStatsTitle:'소유자 통계', statProjects:'프로젝트', statViews:'전체 조회수', statTop:'최고 조회 프로젝트', noStats:'아직 통계가 없습니다.', pageEditHint:'현재 선택한 언어의 페이지 문구만 저장됩니다.', pageSaved:'페이지를 저장했습니다.', pageLoadError:'페이지 내용을 불러오지 못했습니다.', pageSaveError:'페이지 저장 중 오류가 발생했습니다.',
      artifactModalTitleAdd:'프로젝트 추가', artifactModalTitleEdit:'프로젝트 수정', titleLabel:'제목', titlePlaceholder:'예: 오늘의 타로', categoryLabel:'카테고리', descriptionLabel:'설명', descriptionPlaceholder:'카드에 표시될 짧은 소개 문구', dropText:'HTML, JSX, TSX 파일을 이곳에 끌어다 놓거나 선택하세요.', codeLabel:'코드', codePlaceholder:'HTML 전체 코드 또는 React/JSX 코드를 붙여넣으세요.', detectWaiting:'감지 대기 중',
      emptyPublicTitle:'아직 공개된 프로젝트가 없습니다.', emptyPublicText:'곧 ERBELLO의 프로젝트가 이곳에 정리됩니다.', emptyOwnerTitle:'첫 프로젝트를 추가해보세요.', emptyOwnerText:'소유자 모드에서 HTML 또는 JSX 파일을 등록하면 카드가 만들어집니다.', emptyHomeTitle:'최근 프로젝트가 아직 없습니다.', emptyHomeText:'프로젝트를 추가하면 홈에도 최신 카드가 표시됩니다.',
      untitled:'제목 없음', noDescription:'설명이 없습니다.', noDate:'날짜 없음', views:'조회수', copied:'링크를 복사했습니다.', ownerOn:'소유자 모드가 켜졌습니다.', ownerOffMsg:'소유자 모드를 종료했습니다.', previewNoSave:'미리보기 파일에서는 저장되지 않습니다.', needPassword:'비밀번호를 입력해주세요.', notConfigured:'서버에 관리자 비밀번호가 설정되지 않았습니다.', wrongPassword:'비밀번호가 맞지 않습니다.', required:'제목과 코드를 입력해주세요.', saveError:'저장 중 오류가 발생했습니다.', loadError:'프로젝트를 불러오지 못했습니다.', confirmDelete:'정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.', saved:'저장했습니다.', deleted:'삭제했습니다.', fileLoaded:'파일을 불러왔습니다.', detectHtml:'HTML 프로젝트로 감지했습니다.', detectJsx:'React / JSX 프로젝트로 감지했습니다.',
      typeHtml:'HTML', typeReact:'React / JSX', typeGame:'게임', typeTool:'도구', typeDaily:'일상', typeDesign:'디자인', typeChart:'차트', typeExperiment:'실험', typeOther:'기타',
      categories:{ all:'전체', html:'Web App', react:'JSX', game:'게임', tool:'도구', daily:'일상', design:'디자인', chart:'차트', experiment:'실험', other:'기타' }, colors: COMMON.colors, schemes:{black:'Black', white:'White'},
      defaultPages: {
        home:{ script:'어서오세요!', eyebrow:'개인 프로젝트 갤러리', title:'ERBELLO의 저장소입니다.', body:'작게나마 만든 프로젝트 갤러리입니다! 자유롭게 구경해주세요!', infoTitle:'ERBELLO.INFO', blocks:[{title:'개인 프로젝트 컬렉션', text:'작은 아이디어에서 시작된 다양한 프로젝트를 모았습니다.'},{title:'실험과 기록', text:'배우고, 만들고, 기록하는 과정을 공유합니다.'},{title:'지속적인 업데이트', text:'새로운 프로젝트가 꾸준히 추가됩니다.'}] },
        projects:{ eyebrow:'프로젝트', title:'프로젝트 갤러리', body:'카드를 열어 프로젝트를 확인하고 링크로 공유할 수 있습니다.', infoTitle:'', blocks:[] },
        about:{ eyebrow:'ABOUT', title:'ERBELLO 소개', body:'ERBELLO는 완성된 HTML 페이지, React/JSX 아티팩트, 작은 게임과 도구를 모아두는 개인 프로젝트 갤러리입니다.', infoTitle:'ABOUT.INFO', blocks:[{title:'작게 시작한 프로젝트', text:'아이디어를 빠르게 만들고 실제로 열어볼 수 있는 형태로 보관합니다.'},{title:'보여주기 좋은 갤러리', text:'각 프로젝트를 카드로 정리해 방문자가 쉽게 둘러볼 수 있게 합니다.'},{title:'계속 바뀌는 저장소', text:'새로운 작업물이 생기면 천천히 업데이트됩니다.'}] },
        contact:{ eyebrow:'CONTACT', title:'연락처', body:'프로젝트 문의나 공유하고 싶은 이야기가 있다면 아래 링크를 이용해주세요.', infoTitle:'CONTACT.INFO', email:'', links:[], blocks:[] }
      },
      samples:[['sample-receipt','영수증 뽑기 🧾','간편하게 영수증을 생성하고 다운로드해 보세요!','tool'],['sample-tarot','오늘의 타로 🔮','오늘의 운세를 타로 카드로 확인해 보세요.','daily'],['sample-typing','타자 속도 측정기 ⚡','나의 타자 속도와 정확도를 측정해 보세요.','tool'],['sample-pudding','푸딩 게임 🎮','귀여운 푸딩을 모아 최고 점수에 도전하세요!','game'],['sample-note','Mini Note 📝','간단한 메모를 빠르게 작성하고 관리하세요.','daily'],['sample-box','Random Box 🎁','랜덤 박스를 열어 오늘의 행운을 만나보세요!','experiment'],['sample-night','Night Sky Diary ⭐','밤하늘의 감성과 생각을 기록하는 다이어리.','daily'],['sample-cherry','Cherry Blossom Timer 🌸','벚꽃이 흩날리는 집중 타이머로 생산성을 높여보세요.','tool'],['sample-ocean','Ocean Mood Board 🌊','바다의 분위기를 담은 무드보드 모음.','design']]
    },
    en: {
      pageTitle:'ERBELLO Gallery', metaDescription:'A personal project gallery by ERBELLO.', brandAria:'Go to ERBELLO home', brandSubtitle:'Project Gallery', navAria:'Primary navigation', navHome:'Home', navProjects:'Projects', navAbout:'About', navContact:'Contact', topControlsAria:'Language and theme settings', languageLabel:'Language', languageAria:'Choose language', themeLabel:'Theme', themeAria:'Choose theme', schemeLabel:'Background', colorLabel:'Accent color', schemeBlack:'Black', schemeWhite:'White', ownerLogin:'Owner Login', ownerLogout:'Exit Owner Mode', editPage:'Edit Page', addProject:'Add Project', previewBadge:'Preview', previewNotice:'This file is for design preview. Saving works on the deployed site.', lastUpdate:'LAST UPDATE', recentKicker:'Recent', recentProjects:'Recent Projects', viewAllProjects:'View All Projects', sectionKicker:'Projects', galleryTitle:'Project Gallery', searchPlaceholder:'Search projects...', searchAria:'Search projects', filterAria:'Category filter', viewerAria:'Owner preview', viewerFrameTitle:'Project preview', ownerPreview:'Owner Preview', openProject:'Open project', copyLink:'Copy Link', openNewTab:'Open New Tab', edit:'Edit', delete:'Delete', close:'Close', cancel:'Cancel', login:'Log in', save:'Save', adminHint:'Adding, editing and deleting projects is available only in owner mode.', passwordLabel:'Admin password', passwordPlaceholder:'ADMIN_PASSWORD set in Vercel', pageModalTitle:'Edit Page Content', pageLabel:'Page', scriptLabel:'Speech bubble text', eyebrowLabel:'Small title', infoTitleLabel:'Info box title', pageTitleLabel:'Main title', bodyLabel:'Body', blocksLabel:'Info Items', blockTextLabel:'Text', emailLabel:'Email', linksLabel:'Links', linksPlaceholder:'GitHub | https://github.com/...\nInstagram | https://instagram.com/...', contactLinksTitle:'Contact Links', contactLinkName:'Display name', contactLinkUrl:'Link URL', contactAddLink:'Add Link', contactRemoveLink:'Remove', contactLinkHint:'Only items with a URL appear on the contact page. If the name is blank, it will be filled from the URL.', contactEmpty:'No contact links have been added yet.', manageContactLinks:'Manage Contact Links', adminStatsTitle:'Owner Stats', statProjects:'Projects', statViews:'Total Views', statTop:'Top Project', noStats:'No stats yet.', pageEditHint:'Only the selected language content will be saved.', pageSaved:'Page saved.', pageLoadError:'Could not load page content.', pageSaveError:'Could not save page content.', artifactModalTitleAdd:'Add Project', artifactModalTitleEdit:'Edit Project', titleLabel:'Title', titlePlaceholder:'Example: Daily Tarot', categoryLabel:'Category', descriptionLabel:'Description', descriptionPlaceholder:'Short intro shown on the card', dropText:'Drag an HTML, JSX or TSX file here, or choose one.', codeLabel:'Code', codePlaceholder:'Paste a full HTML document or React/JSX code.', detectWaiting:'Waiting for detection', emptyPublicTitle:'No public projects yet.', emptyPublicText:'ERBELLO projects will appear here soon.', emptyOwnerTitle:'Add your first project.', emptyOwnerText:'Upload an HTML or JSX file in owner mode to create a card.', emptyHomeTitle:'No recent projects yet.', emptyHomeText:'When projects are added, recent cards will appear on the home page.', untitled:'Untitled', noDescription:'No description.', noDate:'No date', views:'Views', copied:'Link copied.', ownerOn:'Owner mode is on.', ownerOffMsg:'Owner mode has ended.', previewNoSave:'Preview files do not save changes.', needPassword:'Please enter the password.', notConfigured:'Admin password is not configured on the server.', wrongPassword:'Wrong password.', required:'Please enter a title and code.', saveError:'An error occurred while saving.', loadError:'Could not load projects.', confirmDelete:'Delete this project? This cannot be undone.', saved:'Saved.', deleted:'Deleted.', fileLoaded:'File loaded.', detectHtml:'Detected as an HTML project.', detectJsx:'Detected as a React / JSX project.', typeHtml:'HTML', typeReact:'React / JSX', typeGame:'Game', typeTool:'Tool', typeDaily:'Daily', typeDesign:'Design', typeChart:'Chart', typeExperiment:'Experiment', typeOther:'Other', categories:{all:'All', html:'Web App', react:'JSX', game:'Game', tool:'Tool', daily:'Daily', design:'Design', chart:'Chart', experiment:'Experiment', other:'Other'}, colors:COMMON.colors, schemes:COMMON.schemes,
      defaultPages:{ home:{script:'Welcome!', eyebrow:'Personal Project Gallery', title:'This is ERBELLO\'s archive.', body:'A small project gallery. Feel free to look around!', infoTitle:'ERBELLO.INFO', blocks:[{title:'Personal Project Collection', text:'A collection of projects that started from small ideas.'},{title:'Experiments and Records', text:'Sharing the process of learning, making and recording.'},{title:'Continuous Updates', text:'New projects are added little by little.'}]}, projects:{eyebrow:'Projects', title:'Project Gallery', body:'Open a card to view a project, or copy a link to share it.', infoTitle:'', blocks:[]}, about:{eyebrow:'ABOUT', title:'About ERBELLO', body:'ERBELLO is a personal project gallery for completed HTML pages, React/JSX artifacts, small games and tools.', infoTitle:'ABOUT.INFO', blocks:[{title:'Small Projects', text:'Ideas are stored in a form that can be opened and shared.'},{title:'Gallery for Viewing', text:'Projects are organized as cards so visitors can browse them easily.'},{title:'A Growing Archive', text:'New work is added gradually as it is made.'}]}, contact:{eyebrow:'CONTACT', title:'Contact', body:'Use the links below for project questions or messages.', infoTitle:'CONTACT.INFO', email:'', links:[], blocks:[]} },
      samples:[['sample-receipt','Receipt Maker 🧾','Create a simple receipt and download it.','tool'],['sample-tarot','Daily Tarot 🔮','Check today’s mood with tarot cards.','daily'],['sample-typing','Typing Speed Test ⚡','Measure typing speed and accuracy.','tool'],['sample-pudding','Pudding Game 🎮','Collect cute pudding and aim for a high score.','game'],['sample-note','Mini Note 📝','Write and manage quick notes.','daily'],['sample-box','Random Box 🎁','Open a random box and meet today’s luck.','experiment'],['sample-night','Night Sky Diary ⭐','A diary for night-sky moods and thoughts.','daily'],['sample-cherry','Cherry Blossom Timer 🌸','A focus timer with falling cherry blossoms.','tool'],['sample-ocean','Ocean Mood Board 🌊','A mood board filled with ocean atmosphere.','design']]
    },
    ja: {
      pageTitle:'ERBELLO Gallery', metaDescription:'ERBELLOの個人プロジェクトギャラリーです。', brandAria:'ERBELLOホームへ移動', brandSubtitle:'Project Gallery', navAria:'メインメニュー', navHome:'ホーム', navProjects:'プロジェクト', navAbout:'紹介', navContact:'連絡先', topControlsAria:'言語とテーマ設定', languageLabel:'言語', languageAria:'言語を選択', themeLabel:'テーマ', themeAria:'テーマを選択', schemeLabel:'背景', colorLabel:'アクセントカラー', schemeBlack:'Black', schemeWhite:'White', ownerLogin:'オーナーログイン', ownerLogout:'オーナーモード終了', editPage:'ページ編集', addProject:'プロジェクト追加', previewBadge:'プレビュー', previewNotice:'このファイルはデザイン確認用です。保存は公開サイトで行われます。', lastUpdate:'LAST UPDATE', recentKicker:'最近', recentProjects:'最近のプロジェクト', viewAllProjects:'すべて見る', sectionKicker:'プロジェクト', galleryTitle:'プロジェクトギャラリー', searchPlaceholder:'プロジェクト検索...', searchAria:'プロジェクト検索', filterAria:'カテゴリー絞り込み', viewerAria:'オーナープレビュー', viewerFrameTitle:'プロジェクトプレビュー', ownerPreview:'オーナープレビュー', openProject:'開く', copyLink:'リンクコピー', openNewTab:'新しいタブで開く', edit:'編集', delete:'削除', close:'閉じる', cancel:'キャンセル', login:'ログイン', save:'保存', adminHint:'追加・編集・削除はオーナーモードでのみ利用できます。', passwordLabel:'管理者パスワード', passwordPlaceholder:'Vercelで設定したADMIN_PASSWORD', pageModalTitle:'ページ内容編集', pageLabel:'ページ', scriptLabel:'吹き出し文', eyebrowLabel:'小見出し', infoTitleLabel:'情報ボックス名', pageTitleLabel:'大見出し', bodyLabel:'本文', blocksLabel:'情報項目', blockTextLabel:'内容', emailLabel:'メール', linksLabel:'リンク', linksPlaceholder:'GitHub | https://github.com/...\nInstagram | https://instagram.com/...', contactLinksTitle:'連絡先リンク', contactLinkName:'表示名', contactLinkUrl:'リンクURL', contactAddLink:'リンク追加', contactRemoveLink:'削除', contactLinkHint:'連絡先ページにはURLがある項目だけ表示されます。名前が空の場合はURLから自動入力されます。', contactEmpty:'連絡先リンクはまだ登録されていません。', manageContactLinks:'連絡先リンク管理', adminStatsTitle:'オーナー統計', statProjects:'プロジェクト', statViews:'総閲覧数', statTop:'最多閲覧プロジェクト', noStats:'まだ統計がありません。', pageEditHint:'選択した言語のページ文言だけ保存されます。', pageSaved:'ページを保存しました。', pageLoadError:'ページ内容を読み込めませんでした。', pageSaveError:'ページ保存中にエラーが発生しました。', artifactModalTitleAdd:'プロジェクト追加', artifactModalTitleEdit:'プロジェクト編集', titleLabel:'タイトル', titlePlaceholder:'例：今日のタロット', categoryLabel:'カテゴリー', descriptionLabel:'説明', descriptionPlaceholder:'カードに表示する短い紹介文', dropText:'HTML、JSX、TSXファイルをここにドラッグするか選択してください。', codeLabel:'コード', codePlaceholder:'HTML全文またはReact/JSXコードを貼り付けてください。', detectWaiting:'検出待ち', emptyPublicTitle:'まだ公開プロジェクトはありません。', emptyPublicText:'まもなくここにERBELLOのプロジェクトが並びます。', emptyOwnerTitle:'最初のプロジェクトを追加しましょう。', emptyOwnerText:'オーナーモードでHTMLまたはJSXを登録するとカードが作成されます。', emptyHomeTitle:'最近のプロジェクトはまだありません。', emptyHomeText:'プロジェクトを追加するとホームに最新カードが表示されます。', untitled:'無題', noDescription:'説明はありません。', noDate:'日付なし', views:'閲覧数', copied:'リンクをコピーしました。', ownerOn:'オーナーモードがオンになりました。', ownerOffMsg:'オーナーモードを終了しました。', previewNoSave:'プレビューファイルでは保存されません。', needPassword:'パスワードを入力してください。', notConfigured:'サーバーに管理者パスワードが設定されていません。', wrongPassword:'パスワードが正しくありません。', required:'タイトルとコードを入力してください。', saveError:'保存中にエラーが発生しました。', loadError:'プロジェクトを読み込めませんでした。', confirmDelete:'本当に削除しますか？この操作は元に戻せません。', saved:'保存しました。', deleted:'削除しました。', fileLoaded:'ファイルを読み込みました。', detectHtml:'HTMLプロジェクトとして検出しました。', detectJsx:'React / JSXプロジェクトとして検出しました。', typeHtml:'HTML', typeReact:'React / JSX', typeGame:'ゲーム', typeTool:'ツール', typeDaily:'日常', typeDesign:'デザイン', typeChart:'チャート', typeExperiment:'実験', typeOther:'その他', categories:{all:'すべて', html:'Web App', react:'JSX', game:'ゲーム', tool:'ツール', daily:'日常', design:'デザイン', chart:'チャート', experiment:'実験', other:'その他'}, colors:COMMON.colors, schemes:{black:'Black', white:'White'},
      defaultPages:{ home:{script:'ようこそ！', eyebrow:'個人プロジェクトギャラリー', title:'ERBELLOの保存庫です。', body:'小さく作ったプロジェクトギャラリーです！自由にご覧ください。', infoTitle:'ERBELLO.INFO', blocks:[{title:'個人プロジェクトコレクション', text:'小さなアイデアから始まったさまざまなプロジェクトを集めました。'},{title:'実験と記録', text:'学び、作り、記録する過程を共有します。'},{title:'継続的な更新', text:'新しいプロジェクトが少しずつ追加されます。'}]}, projects:{eyebrow:'プロジェクト', title:'プロジェクトギャラリー', body:'カードを開いてプロジェクトを確認し、リンクで共有できます。', infoTitle:'', blocks:[]}, about:{eyebrow:'ABOUT', title:'ERBELLOについて', body:'ERBELLOは完成したHTMLページ、React/JSXアーティファクト、小さなゲームやツールを集める個人プロジェクトギャラリーです。', infoTitle:'ABOUT.INFO', blocks:[{title:'小さく始めたプロジェクト', text:'アイデアを開いて共有できる形で保存します。'},{title:'見せやすいギャラリー', text:'プロジェクトをカードで整理し、訪問者が見やすいようにします。'},{title:'育っていく保存庫', text:'新しい作品ができるたびに少しずつ更新されます。'}]}, contact:{eyebrow:'CONTACT', title:'連絡先', body:'プロジェクトのお問い合わせやメッセージは下のリンクをご利用ください。', infoTitle:'CONTACT.INFO', email:'', links:[], blocks:[]} },
      samples:[['sample-receipt','レシート作成 🧾','シンプルなレシートを作成して保存できます。','tool'],['sample-tarot','今日のタロット 🔮','今日の気分をタロットカードで確認できます。','daily'],['sample-typing','タイピング速度測定 ⚡','タイピング速度と正確さを測定します。','tool'],['sample-pudding','プリンゲーム 🎮','かわいいプリンを集めて高得点を目指します。','game'],['sample-note','Mini Note 📝','小さなメモをすばやく管理できます。','daily'],['sample-box','Random Box 🎁','ランダムボックスで今日の運を開けます。','experiment'],['sample-night','Night Sky Diary ⭐','夜空の気分を記録する日記。','daily'],['sample-cherry','Cherry Blossom Timer 🌸','桜が舞う集中タイマーです。','tool'],['sample-ocean','Ocean Mood Board 🌊','海の雰囲気を集めたムードボード。','design']]
    },
    zh: {
      pageTitle:'ERBELLO Gallery', metaDescription:'ERBELLO 的个人项目画廊。', brandAria:'前往 ERBELLO 首页', brandSubtitle:'Project Gallery', navAria:'主导航', navHome:'首页', navProjects:'项目', navAbout:'介绍', navContact:'联系', topControlsAria:'语言和主题设置', languageLabel:'语言', languageAria:'选择语言', themeLabel:'主题', themeAria:'选择主题', schemeLabel:'背景', colorLabel:'强调色', schemeBlack:'Black', schemeWhite:'White', ownerLogin:'所有者登录', ownerLogout:'退出所有者模式', editPage:'编辑页面', addProject:'添加项目', previewBadge:'预览', previewNotice:'此文件仅用于设计预览。保存功能请在已部署的网站中使用。', lastUpdate:'LAST UPDATE', recentKicker:'最近', recentProjects:'最近项目', viewAllProjects:'查看全部项目', sectionKicker:'项目', galleryTitle:'项目画廊', searchPlaceholder:'搜索项目...', searchAria:'搜索项目', filterAria:'分类筛选', viewerAria:'所有者预览', viewerFrameTitle:'项目预览', ownerPreview:'所有者预览', openProject:'打开', copyLink:'复制链接', openNewTab:'在新标签页打开', edit:'编辑', delete:'删除', close:'关闭', cancel:'取消', login:'登录', save:'保存', adminHint:'添加、编辑和删除项目仅限所有者模式使用。', passwordLabel:'管理员密码', passwordPlaceholder:'在 Vercel 中设置的 ADMIN_PASSWORD', pageModalTitle:'编辑页面内容', pageLabel:'页面', scriptLabel:'气泡文字', eyebrowLabel:'小标题', infoTitleLabel:'信息框标题', pageTitleLabel:'大标题', bodyLabel:'正文', blocksLabel:'信息项目', blockTextLabel:'内容', emailLabel:'邮箱', linksLabel:'链接', linksPlaceholder:'GitHub | https://github.com/...\nInstagram | https://instagram.com/...', contactLinksTitle:'联系方式链接', contactLinkName:'显示名称', contactLinkUrl:'链接地址', contactAddLink:'添加链接', contactRemoveLink:'删除', contactLinkHint:'联系页只显示带有链接地址的项目。名称为空时会根据链接自动填写。', contactEmpty:'尚未添加联系方式链接。', manageContactLinks:'管理联系方式链接', adminStatsTitle:'所有者统计', statProjects:'项目', statViews:'总浏览量', statTop:'最高浏览项目', noStats:'暂无统计。', pageEditHint:'只会保存当前选择语言的页面文案。', pageSaved:'页面已保存。', pageLoadError:'无法加载页面内容。', pageSaveError:'保存页面时发生错误。', artifactModalTitleAdd:'添加项目', artifactModalTitleEdit:'编辑项目', titleLabel:'标题', titlePlaceholder:'例如：今日塔罗', categoryLabel:'分类', descriptionLabel:'说明', descriptionPlaceholder:'显示在卡片上的简短介绍', dropText:'将 HTML、JSX 或 TSX 文件拖到这里，或选择文件。', codeLabel:'代码', codePlaceholder:'粘贴完整 HTML 文档或 React/JSX 代码。', detectWaiting:'等待检测', emptyPublicTitle:'还没有公开项目。', emptyPublicText:'ERBELLO 的项目很快会整理在这里。', emptyOwnerTitle:'添加第一个项目吧。', emptyOwnerText:'在所有者模式中上传 HTML 或 JSX 文件后，这里会生成项目卡片。', emptyHomeTitle:'还没有最近项目。', emptyHomeText:'添加项目后，首页会显示最新卡片。', untitled:'未命名', noDescription:'暂无说明。', noDate:'无日期', views:'浏览量', copied:'链接已复制。', ownerOn:'所有者模式已开启。', ownerOffMsg:'所有者模式已关闭。', previewNoSave:'预览文件不会保存更改。', needPassword:'请输入密码。', notConfigured:'服务器尚未设置管理员密码。', wrongPassword:'密码不正确。', required:'请输入标题和代码。', saveError:'保存时发生错误。', loadError:'无法加载项目。', confirmDelete:'确定要删除吗？此操作无法撤销。', saved:'已保存。', deleted:'已删除。', fileLoaded:'文件已读取。', detectHtml:'检测为 HTML 项目。', detectJsx:'检测为 React / JSX 项目。', typeHtml:'HTML', typeReact:'React / JSX', typeGame:'游戏', typeTool:'工具', typeDaily:'日常', typeDesign:'设计', typeChart:'图表', typeExperiment:'实验', typeOther:'其他', categories:{all:'全部', html:'Web App', react:'JSX', game:'游戏', tool:'工具', daily:'日常', design:'设计', chart:'图表', experiment:'实验', other:'其他'}, colors:COMMON.colors, schemes:{black:'Black', white:'White'},
      defaultPages:{ home:{script:'欢迎！', eyebrow:'个人项目画廊', title:'这里是 ERBELLO 的收藏库。', body:'这是一个小小的项目画廊！欢迎自由参观。', infoTitle:'ERBELLO.INFO', blocks:[{title:'个人项目合集', text:'这里收集了从小想法开始的各种项目。'},{title:'实验与记录', text:'分享学习、制作和记录的过程。'},{title:'持续更新', text:'新的项目会慢慢添加进来。'}]}, projects:{eyebrow:'项目', title:'项目画廊', body:'打开卡片即可查看项目，也可以复制链接直接分享。', infoTitle:'', blocks:[]}, about:{eyebrow:'ABOUT', title:'关于 ERBELLO', body:'ERBELLO 是一个个人项目画廊，用来收集完成的 HTML 页面、React/JSX 作品、小型游戏和工具。', infoTitle:'ABOUT.INFO', blocks:[{title:'从小项目开始', text:'把想法保存成可以打开和分享的形式。'},{title:'适合展示的画廊', text:'用卡片整理项目，让访客更容易浏览。'},{title:'持续成长的收藏库', text:'新的作品会随着制作慢慢更新。'}]}, contact:{eyebrow:'CONTACT', title:'联系', body:'如有项目问题或想分享的信息，请使用下面的链接。', infoTitle:'CONTACT.INFO', email:'', links:[], blocks:[]} },
      samples:[['sample-receipt','收据生成器 🧾','轻松生成小收据并下载。','tool'],['sample-tarot','今日塔罗 🔮','用塔罗卡看看今天的心情。','daily'],['sample-typing','打字速度测试 ⚡','测量你的打字速度和准确度。','tool'],['sample-pudding','布丁游戏 🎮','收集可爱的布丁，挑战高分。','game'],['sample-note','Mini Note 📝','快速记录和整理简短备忘。','daily'],['sample-box','Random Box 🎁','打开随机盒子，遇见今天的好运。','experiment'],['sample-night','Night Sky Diary ⭐','记录夜空心情与想法的日记。','daily'],['sample-cherry','Cherry Blossom Timer 🌸','樱花飘落的专注计时器。','tool'],['sample-ocean','Ocean Mood Board 🌊','收藏海边氛围的灵感板。','design']]
    }
  };

  let artifacts = [];
  let pageRows = [];
  let currentRoute = initialRoute();
  let currentFilter = 'all';
  let searchQuery = '';
  let currentLang = 'ko';
  let adminToken = safeStorage.get('session', 'erbello-admin-token') || '';
  let currentId = null;
  let editingId = null;
  let toastTimer = null;

  function dict() { return I18N[currentLang] || I18N.ko; }
  function tr(key) { return dict()[key] ?? I18N.ko[key] ?? key; }
  function catLabel(type) { return dict().categories[type] || dict().categories.other; }
  function colorLabel(color) { return (dict().colors && dict().colors[color]) || (I18N.en.colors && I18N.en.colors[color]) || color; }
  function schemeLabel(scheme) { return (dict().schemes && dict().schemes[scheme]) || (I18N.en.schemes && I18N.en.schemes[scheme]) || scheme; }
  function esc(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function compact(value, max = 150) { const text = String(value || '').replace(/\s+/g, ' ').trim(); return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text; }
  function typeKey(value) { const t = String(value || 'other').toLowerCase(); return CATEGORIES.includes(t) && t !== 'all' ? t : 'other'; }
  function isAdminOn() { return document.body.classList.contains('admin-on'); }
  function runUrl(id) { return PREVIEW_MODE ? `#preview-${encodeURIComponent(id)}` : `${location.origin}/run/${encodeURIComponent(id)}`; }
  function pageUrl(route) { return route === 'home' ? '/' : `/${route}`; }

  function initialRoute() {
    const path = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (path === 'projects' || path === 'about' || path === 'contact') return path;
    return 'home';
  }

  function clone(value) { return JSON.parse(JSON.stringify(value || {})); }

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
    const base = clone(defaults[slug] || fallbackDefaults[slug] || {});
    const row = pageRows.find(item => item.slug === slug && item.lang === lang);
    return mergePage(base, row && row.content);
  }

  function fmtDate(value) {
    if (!value) return tr('noDate');
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return tr('noDate');
    return new Intl.DateTimeFormat(LOCALE[currentLang] || 'ko-KR', { year:'numeric', month:'short', day:'numeric' }).format(d);
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
    if (!response.ok) throw new Error((data && data.error) || `Request failed: ${response.status}`);
    return data;
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
    if (currentNode) currentNode.textContent = `${schemeLabel(currentScheme)} · ${colorLabel(currentColor)}`;
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
    if ($('artifactModalTitle')) $('artifactModalTitle').textContent = editingId ? tr('artifactModalTitleEdit') : tr('artifactModalTitleAdd');
    if (PREVIEW_MODE) artifacts = getPreviewItems();
    renderFilters();
    renderRoute();
    updateDetectHint();
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
    return (dict().samples || I18N.ko.samples).map(([id, title, description, type], index) => ({ id, title, description, type, is_jsx:id.includes('tarot') || id.includes('pudding'), view_count: Math.max(0, 1280 - index * 117), created_at:new Date(base - index * 86400000).toISOString(), code:previewDocument(title, description) }));
  }

  function previewDocument(title, text) {
    return `<!doctype html><html lang="${document.documentElement.lang || 'ko'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 20% 10%,rgba(255,79,146,.18),transparent 25rem),radial-gradient(circle at 80% 20%,rgba(42,216,255,.14),transparent 28rem),linear-gradient(#0a1220 1px,transparent 1px),linear-gradient(90deg,#0a1220 1px,transparent 1px),#050914;background-size:auto,auto,28px 28px,28px 28px;color:#f7f8ff;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.box{width:min(760px,calc(100% - 36px));padding:42px;border:1px solid rgba(255,79,146,.35);background:rgba(7,13,24,.88);box-shadow:0 28px 80px rgba(0,0,0,.42);clip-path:polygon(18px 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%,0 18px)}.label{color:#ff4f92;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:950;letter-spacing:.18em;text-transform:uppercase;font-size:12px}h1{font-size:clamp(30px,5vw,58px);letter-spacing:-.04em;line-height:1.08;margin:14px 0 16px}p{font-size:18px;line-height:1.75;color:#aeb8ca;margin:0}</style></head><body><main class="box"><div class="label">ERBELLO Preview</div><h1>${esc(title)}</h1><p>${esc(text)}</p></main></body></html>`;
  }

  function goRoute(route, replace = false) {
    const next = ROUTES.includes(route) ? route : 'home';
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

  function renderPageContent() {
    const home = pageContent('home');
    if ($('homeScript')) $('homeScript').textContent = home.script || '';
    if ($('homeEyebrow')) $('homeEyebrow').textContent = home.eyebrow || '';
    if ($('heroTitle')) $('heroTitle').textContent = home.title || '';
    if ($('homeBody')) $('homeBody').textContent = home.body || '';
    if ($('infoTitle')) $('infoTitle').textContent = home.infoTitle || 'ERBELLO.INFO';
    renderInfoBlocks('homeBlocks', home.blocks || []);

    const projects = pageContent('projects');
    if ($('projectsEyebrow')) $('projectsEyebrow').textContent = projects.eyebrow || '';
    if ($('projectsTitle')) $('projectsTitle').textContent = projects.title || '';
    if ($('projectsBody')) $('projectsBody').textContent = projects.body || '';

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
  }

  function renderFilters() {
    const node = $('filters');
    if (!node) return;
    node.innerHTML = CATEGORIES.map((key) => `<button class="filter-btn ${key === currentFilter ? 'active' : ''}" type="button" data-filter="${esc(key)}">${esc(catLabel(key))}</button>`).join('');
    node.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => { currentFilter = button.dataset.filter || 'all'; renderFilters(); renderGrid(); });
    });
  }

  function filteredArtifacts() {
    const q = searchQuery.trim().toLowerCase();
    return artifacts.filter((item) => {
      const type = typeKey(item.type);
      if (currentFilter !== 'all' && type !== currentFilter) return false;
      if (!q) return true;
      return [item.title, item.description, type, item.is_jsx ? 'jsx react' : 'html'].join(' ').toLowerCase().includes(q);
    });
  }

  function emptyMessage(home = false) {
    if (home) return `<div class="empty"><div><h2>${esc(tr('emptyHomeTitle'))}</h2><p>${esc(tr('emptyHomeText'))}</p></div></div>`;
    return ownerModeRequested ? `<div class="empty"><div><h2>${esc(tr('emptyOwnerTitle'))}</h2><p>${esc(tr('emptyOwnerText'))}</p></div></div>` : `<div class="empty"><div><h2>${esc(tr('emptyPublicTitle'))}</h2><p>${esc(tr('emptyPublicText'))}</p></div></div>`;
  }

  function visualProfile(item) {
    const hay = `${item.title || ''} ${item.description || ''} ${item.type || ''}`.toLowerCase();
    const checks = [ ['visual-receipt','🧾',['receipt','영수증','收据','レシート']], ['visual-tarot','🔮',['tarot','타로','塔罗','タロット']], ['visual-typing','⌨️',['typing','타자','타이핑','打字','タイピング']], ['visual-pudding','🍮',['pudding','푸딩','布丁','プリン']], ['visual-note','📝',['note','memo','메모','ノート','备忘']], ['visual-box','🎁',['random','box','랜덤','박스','随机','ボックス']], ['visual-night','🌙',['night','sky','diary','밤하늘','夜空']], ['visual-cherry','🌸',['cherry','blossom','벚꽃','桜','樱花']], ['visual-ocean','🌊',['ocean','sea','바다','오션','海']] ];
    for (const [klass, icon, words] of checks) if (words.some((word) => hay.includes(word.toLowerCase()))) return { klass, icon };
    const fallback = { html:['visual-cherry','🌐'], react:['visual-tarot','✨'], game:['visual-pudding','🎮'], tool:['visual-receipt','🛠️'], daily:['visual-note','📝'], design:['visual-ocean','🎨'], chart:['visual-ocean','📊'], experiment:['visual-box','🧪'], other:['visual-default','✦'] }[typeKey(item.type)] || ['visual-default','✦'];
    return { klass:fallback[0], icon:fallback[1] };
  }

  function cardMarkup(item, compactCard = false) {
    const type = typeKey(item.type);
    const title = item.title || tr('untitled');
    const desc = item.description || tr('noDescription');
    const profile = visualProfile(item);
    const views = Number(item.view_count || 0);
    return `<article class="card ${compactCard ? 'card-compact' : ''}" data-id="${esc(item.id)}" tabindex="0" aria-label="${esc(title)}">
      <div class="card-visual ${esc(profile.klass)}"><span class="visual-title">${esc(catLabel(type))}</span><span class="visual-emoji" aria-hidden="true">${esc(profile.icon)}</span><span class="tag">${esc(catLabel(type))}</span></div>
      <div class="card-body"><h3 class="card-title">${esc(title)}</h3><p class="card-desc">${esc(compact(desc, 118))}</p>
        <div class="card-foot"><span class="card-date" title="${esc(fmtDate(item.created_at))}">▣ ${esc(fmtDate(item.created_at))}</span><span class="view-count admin-only">◉ ${esc(tr('views'))} ${views}</span>
          <div class="card-actions"><button class="circle-action" type="button" data-open="${esc(item.id)}" aria-label="${esc(tr('openProject'))}">↗</button><button class="circle-action" type="button" data-copy="${esc(item.id)}" aria-label="${esc(tr('copyLink'))}">⛓</button><button class="btn small admin-only" type="button" data-edit="${esc(item.id)}">${esc(tr('edit'))}</button><button class="btn small danger admin-only" type="button" data-remove="${esc(item.id)}">${esc(tr('delete'))}</button></div>
        </div></div></article>`;
  }

  function bindCardEvents(container) {
    if (!container) return;
    container.querySelectorAll('.card').forEach((card) => {
      const id = card.dataset.id;
      card.addEventListener('click', (event) => { if (!event.target.closest('button')) openArtifact(id); });
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openArtifact(id); } });
    });
    container.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => openArtifact(button.dataset.open)));
    container.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', () => copyText(runUrl(button.dataset.copy))));
    container.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => requireAdmin(() => editArtifact(button.dataset.edit))));
    container.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => requireAdmin(() => deleteArtifact(button.dataset.remove))));
  }

  function renderGrid() {
    const grid = $('grid');
    if (!grid) return;
    const items = filteredArtifacts();
    if (!items.length) { grid.innerHTML = emptyMessage(false); return; }
    grid.innerHTML = items.map((item) => cardMarkup(item, false)).join('');
    bindCardEvents(grid);
  }

  function renderFeaturedGrid() {
    const grid = $('featuredGrid');
    if (!grid) return;
    const items = artifacts.slice(0, 4);
    if (!items.length) { grid.innerHTML = emptyMessage(true); return; }
    grid.innerHTML = items.map((item) => cardMarkup(item, true)).join('');
    bindCardEvents(grid);
  }

  function findArtifact(id) { return artifacts.find((item) => String(item.id) === String(id)); }

  function openArtifact(id) {
    if (!id) return;
    if (PREVIEW_MODE || isAdminOn()) openViewer(id);
    else window.location.href = runUrl(id);
  }

  function openViewer(id) {
    const item = findArtifact(id);
    if (!item) return;
    currentId = id;
    $('viewerTag').textContent = `${catLabel(typeKey(item.type))} · ${item.is_jsx ? 'JSX' : 'HTML'}`;
    $('viewerTitle').textContent = item.title || tr('untitled');
    $('viewerDesc').textContent = item.description || tr('ownerPreview');
    if ($('viewerViews')) $('viewerViews').textContent = `${tr('views')}: ${Number(item.view_count || 0)}`;
    const frame = $('viewerFrame');
    if (PREVIEW_MODE) { frame.removeAttribute('src'); frame.srcdoc = item.code || previewDocument(item.title || tr('untitled'), item.description || ''); }
    else { frame.removeAttribute('srcdoc'); frame.src = `${runUrl(id)}?ownerPreview=1`; }
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
    try { artifacts = await api('/api/artifacts'); }
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
    const code = $('codeInput')?.value || '';
    if (!code.trim()) { node.textContent = tr('detectWaiting'); return; }
    const jsx = looksLikeJsx(code);
    node.textContent = jsx ? tr('detectJsx') : tr('detectHtml');
    if (jsx && $('typeInput')) $('typeInput').value = 'react';
  }

  function resetArtifactForm() {
    editingId = null;
    $('artifactModalTitle').textContent = tr('artifactModalTitleAdd');
    $('titleInput').value = '';
    $('descInput').value = '';
    $('typeInput').value = 'html';
    $('codeInput').value = '';
    $('fileInput').value = '';
    $('detectHint').textContent = tr('detectWaiting');
    $('artifactError').textContent = '';
  }

  function openAddModal() { resetArtifactForm(); openModal('artifactModal'); setTimeout(() => $('titleInput').focus(), 60); }

  async function editArtifact(id) {
    try {
      const item = PREVIEW_MODE ? findArtifact(id) : await api(`/api/admin/artifacts/${encodeURIComponent(id)}`, { headers:{ 'x-admin-token':adminToken } });
      if (!item) throw new Error('not found');
      editingId = id;
      $('artifactModalTitle').textContent = tr('artifactModalTitleEdit');
      $('titleInput').value = item.title || '';
      $('descInput').value = item.description || '';
      $('typeInput').value = typeKey(item.type);
      $('codeInput').value = item.code || '';
      $('fileInput').value = '';
      $('artifactError').textContent = '';
      updateDetectHint();
      openModal('artifactModal');
    } catch (error) { console.error(error); toast(tr('loadError')); }
  }

  async function saveArtifact() {
    if (PREVIEW_MODE) { toast(tr('previewNoSave')); return; }
    const title = $('titleInput').value.trim();
    const description = $('descInput').value.trim();
    const type = $('typeInput').value;
    const code = normalizeCode($('codeInput').value);
    $('artifactError').textContent = '';
    if (!title || !code) { $('artifactError').textContent = tr('required'); return; }
    try {
      const payload = { title, description, type, code };
      if (editingId) await api(`/api/admin/artifacts/${encodeURIComponent(editingId)}`, { method:'PUT', headers:{ 'x-admin-token':adminToken }, body:JSON.stringify(payload) });
      else await api('/api/admin/artifacts', { method:'POST', headers:{ 'x-admin-token':adminToken }, body:JSON.stringify(payload) });
      closeModal('artifactModal');
      toast(tr('saved'));
      await loadArtifacts();
    } catch (error) { console.error(error); $('artifactError').textContent = error.message || tr('saveError'); }
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

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      $('codeInput').value = String(reader.result || '');
      if (!$('titleInput').value.trim()) $('titleInput').value = file.name.replace(/\.(html?|jsx?|tsx?|txt)$/i, '').replace(/[-_]+/g, ' ');
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
    const setHidden = (id, hidden) => { const node = $(id); if (node) node.hidden = hidden; };
    setHidden('pageScriptField', !isHome);
    setHidden('pageInfoField', !isHome);
    setHidden('pageBlocksEditor', !(isHome || isAbout));
    setHidden('pageEmailField', !isContact);
    setHidden('pageLinksField', !isContact);
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
    const content = { script:$('pageScriptInput').value.trim(), eyebrow:$('pageEyebrowInput').value.trim(), infoTitle:$('pageInfoTitleInput').value.trim(), title:$('pageTitleInput').value.trim(), body:$('pageBodyInput').value.trim(), blocks, email:$('pageEmailInput').value.trim(), links: slug === 'contact' ? collectContactLinks() : [] };
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

  function bindEvents() {
    $('themeToggle')?.addEventListener('click', toggleThemeMenu);
    document.querySelectorAll('[data-scheme-choice]').forEach((button) => button.addEventListener('click', () => { applyTheme(button.dataset.schemeChoice || 'black', validColor(document.body.dataset.color)); }));
    document.querySelectorAll('[data-color-choice]').forEach((button) => button.addEventListener('click', () => { applyTheme(validScheme(document.body.dataset.scheme), button.dataset.colorChoice || 'crimson'); }));
    document.addEventListener('click', (event) => { if (!event.target.closest('#themePicker')) closeThemeMenu(); });
    $('langSelect')?.addEventListener('change', (event) => applyLanguage(event.target.value));
    document.querySelectorAll('[data-route]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); goRoute(link.dataset.route || 'home'); }));
    window.addEventListener('popstate', () => { currentRoute = initialRoute(); renderRoute(); });
    $('searchInput')?.addEventListener('input', (event) => { searchQuery = event.target.value; renderGrid(); });
    $('adminBtn')?.addEventListener('click', () => {
      if (isAdminOn()) { setAdminUI(false); adminToken = ''; safeStorage.remove('session', 'erbello-admin-token'); toast(tr('ownerOffMsg')); }
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
    $('addBtn')?.addEventListener('click', () => requireAdmin(openAddModal));
    $('addBtnToolbar')?.addEventListener('click', () => requireAdmin(openAddModal));
    document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));
    document.querySelectorAll('.overlay').forEach((overlay) => overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(overlay.id); }));
    $('unlockBtn')?.addEventListener('click', unlockAdmin);
    $('passwordInput')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') unlockAdmin(); });
    $('saveArtifactBtn')?.addEventListener('click', saveArtifact);
    $('codeInput')?.addEventListener('input', updateDetectHint);
    $('fileInput')?.addEventListener('change', (event) => handleFile(event.target.files && event.target.files[0]));
    const dz = $('dropZone');
    if (dz) {
      ['dragenter','dragover'].forEach((name) => dz.addEventListener(name, (event) => { event.preventDefault(); dz.classList.add('drag'); }));
      ['dragleave','drop'].forEach((name) => dz.addEventListener(name, (event) => { event.preventDefault(); dz.classList.remove('drag'); }));
      dz.addEventListener('drop', (event) => handleFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]));
    }
    $('closeViewerBtn')?.addEventListener('click', closeViewer);
    $('copyRunBtn')?.addEventListener('click', () => currentId && copyText(runUrl(currentId)));
    $('openRunBtn')?.addEventListener('click', () => currentId && window.open(runUrl(currentId), '_blank', 'noopener,noreferrer'));
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
    applyTheme(SCHEMES.includes(storedScheme) ? storedScheme : 'black', COLORS.includes(storedColor) ? storedColor : 'crimson');
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
