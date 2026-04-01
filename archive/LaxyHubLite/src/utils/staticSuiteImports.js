// Static imports for suite data as a fallback
// This will be used if import.meta.glob doesn't work as expected

// Import all suite data files statically
// Import only one file first to test
  import familyRoom01En from '../mocks/suites/beppu-airbnb/family-room-01/en.json';
import familyRoom01Ja from '../mocks/suites/beppu-airbnb/family-room-01/ja.json';
import familyRoom01Ko from '../mocks/suites/beppu-airbnb/family-room-01/ko.json';
import familyRoom01ZhHans from '../mocks/suites/beppu-airbnb/family-room-01/zh-Hans.json';
import familyRoom01ZhHant from '../mocks/suites/beppu-airbnb/family-room-01/zh-Hant.json';

import familyRoom02En from '../mocks/suites/beppu-airbnb/family-room-02/en.json';
import familyRoom02Ja from '../mocks/suites/beppu-airbnb/family-room-02/ja.json';
import familyRoom02Ko from '../mocks/suites/beppu-airbnb/family-room-02/ko.json';
import familyRoom02ZhHans from '../mocks/suites/beppu-airbnb/family-room-02/zh-Hans.json';
import familyRoom02ZhHant from '../mocks/suites/beppu-airbnb/family-room-02/zh-Hant.json';

import familyRoom03En from '../mocks/suites/beppu-airbnb/family-room-03/en.json';
import familyRoom03Ja from '../mocks/suites/beppu-airbnb/family-room-03/ja.json';
import familyRoom03Ko from '../mocks/suites/beppu-airbnb/family-room-03/ko.json';
import familyRoom03ZhHans from '../mocks/suites/beppu-airbnb/family-room-03/zh-Hans.json';
import familyRoom03ZhHant from '../mocks/suites/beppu-airbnb/family-room-03/zh-Hant.json';

import familyRoom04En from '../mocks/suites/beppu-airbnb/family-room-04/en.json';
import familyRoom04Ja from '../mocks/suites/beppu-airbnb/family-room-04/ja.json';
import familyRoom04Ko from '../mocks/suites/beppu-airbnb/family-room-04/ko.json';
import familyRoom04ZhHans from '../mocks/suites/beppu-airbnb/family-room-04/zh-Hans.json';
import familyRoom04ZhHant from '../mocks/suites/beppu-airbnb/family-room-04/zh-Hant.json';

// Create the suite modules object in the same format as import.meta.glob would return
export const staticSuiteModules = {
  '../mocks/suites/beppu-airbnb/family-room-01/en.json': familyRoom01En,
  '../mocks/suites/beppu-airbnb/family-room-01/ja.json': familyRoom01Ja,
  '../mocks/suites/beppu-airbnb/family-room-01/ko.json': familyRoom01Ko,
  '../mocks/suites/beppu-airbnb/family-room-01/zh-Hans.json': familyRoom01ZhHans,
  '../mocks/suites/beppu-airbnb/family-room-01/zh-Hant.json': familyRoom01ZhHant,
  
  '../mocks/suites/beppu-airbnb/family-room-02/en.json': familyRoom02En,
  '../mocks/suites/beppu-airbnb/family-room-02/ja.json': familyRoom02Ja,
  '../mocks/suites/beppu-airbnb/family-room-02/ko.json': familyRoom02Ko,
  '../mocks/suites/beppu-airbnb/family-room-02/zh-Hans.json': familyRoom02ZhHans,
  '../mocks/suites/beppu-airbnb/family-room-02/zh-Hant.json': familyRoom02ZhHant,
  
  '../mocks/suites/beppu-airbnb/family-room-03/en.json': familyRoom03En,
  '../mocks/suites/beppu-airbnb/family-room-03/ja.json': familyRoom03Ja,
  '../mocks/suites/beppu-airbnb/family-room-03/ko.json': familyRoom03Ko,
  '../mocks/suites/beppu-airbnb/family-room-03/zh-Hans.json': familyRoom03ZhHans,
  '../mocks/suites/beppu-airbnb/family-room-03/zh-Hant.json': familyRoom03ZhHant,
  
  '../mocks/suites/beppu-airbnb/family-room-04/en.json': familyRoom04En,
  '../mocks/suites/beppu-airbnb/family-room-04/ja.json': familyRoom04Ja,
  '../mocks/suites/beppu-airbnb/family-room-04/ko.json': familyRoom04Ko,
  '../mocks/suites/beppu-airbnb/family-room-04/zh-Hans.json': familyRoom04ZhHans,
  '../mocks/suites/beppu-airbnb/family-room-04/zh-Hant.json': familyRoom04ZhHant,
};

export default staticSuiteModules;
