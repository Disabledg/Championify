// Electron
import remote from 'remote';

import Promise from 'bluebird';
import { exec } from 'child_process';
import open from 'open';
import path from 'path';
import $ from './js/helpers/jquery';

import championify from './js/championify';
import ChampionifyErrors from './js/errors';
import { EndSession } from './js/helpers';
import Log from './js/logger';
import optionsParser from './js/options_parser';
import preferences from './js/preferences';
import pathManager from './js/path_manager';
import pkg from './package.json';
import store from './js/store';
import T from './js/translate';
import updateManager from './js/update_manager';
import viewManager from './js/view_manager';


// Debugging helpers
window.viewManager = viewManager;

const app = remote.require('app');
const dialog = remote.require('dialog');

let runas;
if (process.platform === 'win32') runas = require('runas');

const loadedPrefs = preferences.load();
if (loadedPrefs && loadedPrefs.locale !== 'en') T.loadPhrases(loadedPrefs.locale);

Log.info('Version: ' + pkg.version);


/**
 * Add system buttons
 */

if (process.platform === 'darwin') {
  $('.osx_buttons').removeClass('hidden');
} else {
  $('.win_buttons').removeClass('hidden');
}

/**
 * Function to call Electrons OpenDialog. Sets title based on Platform.
 */

let folder_dialog_open = false;
function openFolder() {
  if (!folder_dialog_open) {
    folder_dialog_open = true;
    let properties = ['openFile'];
    if (process.platform === 'win32') properties = ['openDirectory'];

    return dialog.showOpenDialog({
      properties,
      title: store.get('browse_title')
    }, selected_path => {
      folder_dialog_open = false;
      if (selected_path) return pathManager.checkInstallPath(selected_path, pathManager.setInstallPath);
    });
  }
}


/**
 * Warn user if their league folder isn't selected.
 */

function selectFolderWarning() {
  $('#input_msg').addClass('yellow');
  $('#input_msg').text(T.t('select_folder'));
  return $('#input_msg').transition('shake');
}


/**
 * Checks league path and imports item sets
 * @returns {Promise}
 */

function importItemSets() {
  if (!store.get('lol_install_path')) {
    selectFolderWarning();
    return Promise.resolve(false);
  }

  let fadeup = false;
  if (!championify.verifySettings()) return Promise.resolve(false);
  $('#btns_versions').addClass('hidden');

  $(`.optionsrow`).transition({
    animation: 'fade down',
    duration: '300ms',
    onComplete: function() {
      if (!fadeup) {
        fadeup = true;
        $('#process_log').transition('fade up', '300ms');
      }
    }
  });

  return championify.run()
    .catch(err => EndSession(err));
}


/**
 * Checks and deletes item sets
 */

function deleteItemSets() {
  if (!store.get('lol_install_path')) {
    selectFolderWarning();
  } else {
    $('#delete_notification').modal('show');
    championify['delete'](true).then(() => $('#delete_notification').find('#progress-icon').html('<i class="check icon" />'));
  }
}

/**
 * Start the League of Legends client.
 */

function startLeague() {
  const exit = function() {
    return setTimeout(() => app.quit(), 500);
  };
  if (process.platform === 'darwin') {
    exec(`open -n "${store.get('lol_install_path')}"`);
    exit();
  } else if (store.get('lol_executable')) {
    exec(`"${path.join(store.get('lol_install_path'), store.get('lol_executable'))}"`);
    exit();
  } else {
    Log.error(`League of legends executable is not defined. ${store.get('lol_executable')}`);
    $('#start_league').attr('class', 'ui inverted red button');
    $('#start_league').text('Can\'t start League');
  }
}


/**
 * Goes through options parameters and acts.
 */

function executeOptionParameters() {
  if (optionsParser['delete']()) {
    deleteItemSets();
  } else if (optionsParser['import']() || optionsParser.autorun()) {
    importItemSets().then(completed => {
      if (optionsParser.close() || optionsParser.autorun()) {
        app.quit();
      } else if (completed) {
        viewManager.complete();
        if (optionsParser.startLeague()) startLeague();
      }
    });
  }
}


/**
 * Execute after view load
*/

viewManager.init().then(() => {
  updateManager.check().spread((version, major) => {
    if (version && optionsParser.update()) {
      if (process.platform === 'win32' && !optionsParser.runnedAsAdmin()) {
        runas(process.execPath, ['--startAsAdmin'], {
          hide: false,
          admin: true
        });
      } else {
        return EndSession(new ChampionifyErrors.UpdateError('Can\'t auto update, please redownload'));
      }
    } else if (version && major) {
      updateManager.majorUpdate(version);
    } else if (version) {
      updateManager.minorUpdate(version);
    } else {
      executeOptionParameters();
    }
  });
});

/**
 * Watches for buttons pressed on GUI.
 */

$(document).on('click', '#browse', function() {
  return openFolder();
});

$(document).on('click', '.donate > a', function(e) {
  e.preventDefault();
  return open('https://salt.bountysource.com/teams/championify');
});

$(document).on('click', '.github > a', function(e) {
  e.preventDefault();
  return open('https://github.com/dustinblackman/Championify#championify');
});

$(document).on('click', '.championify_version > span', function(e) {
  e.preventDefault();
  return open('https://github.com/dustinblackman/Championify/blob/master/CHANGELOG.md');
});

$(document).on('click', '#open_log', function(e) {
  return open(path.join(preferences.directory(), 'championify.log.txt'));
});

$(document).on('click', '#import_btn', function() {
  return importItemSets().then(completed => {
    if (completed) viewManager.complete();
  });
});

$(document).on('click', '#delete_btn', function() {
  return deleteItemSets();
});

$(document).on('input', '#install_path', function() {
  return pathManager.checkInstallPath($(this).val(), pathManager.setInstallPath);
});

$(document).on('click', '.sys_button.minimize', function(e) {
  e.preventDefault();
  return remote.getCurrentWindow().minimize();
});

$(document).on('click', '.sys_button.close', function(e) {
  e.preventDefault();
  return app.quit();
});

$(document).on('click', '#start_league', function() {
  return startLeague();
});

$(document).on('click', '#back_to_main', function() {
  return viewManager.mainBack();
});

$(document).on('click', '#release_button', function() {
  return open('https://github.com/dustinblackman/Championify/releases/latest');
});
